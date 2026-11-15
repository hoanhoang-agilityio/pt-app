import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { ADMIN_COOKIE, USER_COOKIE } from "@/constants/session";
import { db } from "@/db";
import { admins, themeSettings } from "@/db/schema";
import {
  type StoredScope,
  THEME_CACHE_TAG,
} from "@/features/theme/constants/theme";
import { normalizeHex } from "@/features/theme/utils/color";
import { resolveAccent } from "@/features/theme/utils/resolve-accent";
import { isSuperAdmin, toAdminRole } from "@/services/admin-scope";
import { logServerError } from "@/services/logger";
import { readSession } from "@/services/session";

export type StoredAccents = Record<StoredScope, string | null>;

const EMPTY: StoredAccents = { all: null, trainee: null, pt: null };

// A stored value that fails normalization counts as "no override".
const readStoredAccents = async (): Promise<StoredAccents> => {
  const rows = await db.select().from(themeSettings);
  const accents = { ...EMPTY };

  for (const row of rows) {
    accents[row.scope] = normalizeHex(row.accent);
  }
  return accents;
};

// Read on every page render (the root layout), so it is cached and dropped by
// updateTag(THEME_CACHE_TAG) when the super admin saves.
export const getStoredAccents = unstable_cache(
  readStoredAccents,
  [THEME_CACHE_TAG],
  { tags: [THEME_CACHE_TAG] },
);

const findAdminAccent = async (adminId: number) => {
  const [row] = await db
    .select({ role: admins.role, accentColor: admins.accentColor })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1);

  return row
    ? {
        role: toAdminRole(row.role),
        self: isSuperAdmin({ role: toAdminRole(row.role) })
          ? normalizeHex(row.accentColor)
          : null,
      }
    : null;
};

// The accent for whoever is asking, "#rrggbb", or null for the default
// orange. Reads only the session cookies (no passcode or restriction checks:
// this is a display color) and never throws: a failed read, for example before
// the table exists, shows the default instead of breaking every page.
export const getViewerAccent = async (): Promise<string | null> => {
  try {
    const accents = await getStoredAccents();
    const adminSession = await readSession(ADMIN_COOKIE);

    if (adminSession?.role === "admin") {
      const admin = await findAdminAccent(adminSession.adminId);

      if (admin) {
        return resolveAccent({
          self: admin.self,
          role: admin.role === "pt" ? accents.pt : null,
          all: accents.all,
        });
      }
    }
    const userSession = await readSession(USER_COOKIE);

    return resolveAccent({
      role: userSession?.role === "user" ? accents.trainee : null,
      all: accents.all,
    });
  } catch (error) {
    logServerError("getViewerAccent", error);
    return null;
  }
};

export interface ThemeOverview extends StoredAccents {
  self: string | null;
}

// For the settings screen: every scope's current color (null = default).
export const getThemeOverview = async (
  adminId: number,
): Promise<ThemeOverview> => {
  const [accents, admin] = await Promise.all([
    getStoredAccents(),
    findAdminAccent(adminId),
  ]);

  return { ...accents, self: admin?.self ?? null };
};
