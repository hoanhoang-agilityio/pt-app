import "server-only";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { ADMIN_COOKIE, USER_COOKIE } from "@/constants/session";
import { db } from "@/db";
import { admins, themeLocks, themeSettings, users } from "@/db/schema";
import {
  type LockScope,
  type StoredScope,
  THEME_CACHE_TAG,
} from "@/features/theme/constants/theme";
import { normalizeHex } from "@/features/theme/utils/color";
import { resolveAccent } from "@/features/theme/utils/resolve-accent";
import { toAdminRole } from "@/services/admin-scope";
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

export type ThemeLocks = Record<LockScope, boolean>;

const NO_LOCKS: ThemeLocks = { trainee: false, pt: false };

// No row = unlocked.
const readThemeLocks = async (): Promise<ThemeLocks> => {
  const rows = await db.select().from(themeLocks);
  const locks = { ...NO_LOCKS };

  for (const row of rows) {
    locks[row.scope] = row.locked;
  }
  return locks;
};

// Cached under the same tag as the colors: one save invalidates both.
export const getThemeLocks = unstable_cache(
  readThemeLocks,
  [THEME_CACHE_TAG, "locks"],
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
        self: normalizeHex(row.accentColor),
      }
    : null;
};

const findUserAccent = async (userId: number) => {
  const [row] = await db
    .select({ accentColor: users.accentColor })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row ? normalizeHex(row.accentColor) : null;
};

// The accent for whoever is asking, "#rrggbb", or null for the default
// orange. Reads only the session cookies (no passcode or restriction checks:
// this is a display color) and never throws: a failed read, for example before
// the table exists, shows the default instead of breaking every page.
export const getViewerAccent = async (): Promise<string | null> => {
  try {
    const [accents, locks] = await Promise.all([
      getStoredAccents(),
      getThemeLocks(),
    ]);
    const adminSession = await readSession(ADMIN_COOKIE);

    if (adminSession?.role === "admin") {
      const admin = await findAdminAccent(adminSession.adminId);

      if (admin) {
        return resolveAccent({
          self: admin.self,
          role: admin.role === "pt" ? accents.pt : null,
          all: accents.all,
          // The super admin is never locked.
          locked: admin.role === "pt" && locks.pt,
        });
      }
    }
    const userSession = await readSession(USER_COOKIE);

    const isUser = userSession?.role === "user";

    return resolveAccent({
      self: isUser ? await findUserAccent(userSession.userId) : null,
      role: isUser ? accents.trainee : null,
      all: accents.all,
      locked: locks.trainee,
    });
  } catch (error) {
    logServerError("getViewerAccent", error);
    return null;
  }
};

export interface ThemeOverview extends StoredAccents {
  self: string | null;
  locks: ThemeLocks;
}

// For the settings screen: every scope's current color (null = default).
export const getThemeOverview = async (
  adminId: number,
): Promise<ThemeOverview> => {
  const [accents, locks, admin] = await Promise.all([
    getStoredAccents(),
    getThemeLocks(),
    findAdminAccent(adminId),
  ]);

  return { ...accents, self: admin?.self ?? null, locks };
};

export interface PersonalTheme {
  // The viewer's saved personal color, "#rrggbb", or null.
  saved: string | null;
  // The viewer's role is locked, so the picker is unavailable.
  locked: boolean;
}

// For the personal picker page. The super admin is never locked.
export const getPersonalTheme = async (viewer: {
  kind: "user" | "admin";
  id: number;
}): Promise<PersonalTheme> => {
  const locks = await getThemeLocks();

  if (viewer.kind === "user") {
    return { saved: await findUserAccent(viewer.id), locked: locks.trainee };
  }
  const admin = await findAdminAccent(viewer.id);

  return {
    saved: admin?.self ?? null,
    locked: admin?.role === "pt" && locks.pt,
  };
};

// Whether the gear menu may show the entry: false for a locked role.
export const canPickPersonalColor = async (
  kind: "user" | "pt" | "super",
): Promise<boolean> => {
  if (kind === "super") {
    return true;
  }
  try {
    const locks = await getThemeLocks();

    return !locks[kind === "user" ? "trainee" : "pt"];
  } catch (error) {
    logServerError("canPickPersonalColor", error);
    return false;
  }
};
