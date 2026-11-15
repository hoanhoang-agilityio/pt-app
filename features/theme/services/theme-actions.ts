"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { ADMIN_COOKIE } from "@/constants/session";
import { db } from "@/db";
import { admins, themeLocks, themeSettings, users } from "@/db/schema";
import {
  LOCK_SCOPES,
  type LockScope,
  THEME_CACHE_TAG,
  THEME_MESSAGES,
  THEME_SCOPES,
} from "@/features/theme/constants/theme";
import { normalizeHex } from "@/features/theme/utils/color";
import { withResultErrorHandling } from "@/services/action-errors";
import { isSuperAdmin } from "@/services/admin-scope";
import {
  requireAdmin,
  requireSuperAdmin,
  requireUser,
} from "@/services/auth-guard";
import { readSession } from "@/services/session";

const inputSchema = z.object({
  scope: z.enum(THEME_SCOPES, THEME_MESSAGES.INVALID_SCOPE),
  color: z.string().max(32, THEME_MESSAGES.INVALID_COLOR).nullable(),
});

// Saves (or, with color null, resets) the app primary color of one scope.
// Super admin only. Saving "all" clears the trainee and pt rows so everyone
// really gets the one color. The server stores what was chosen; the contrast
// warning is advice in the UI, and the dark variant is derived at render time.
export const setAccentColorAction = withResultErrorHandling(
  "setAccentColor",
  async (input: { scope: string; color: string | null }) => {
    const admin = await requireSuperAdmin();
    const parsed = inputSchema.safeParse(input);

    if (!parsed.success) {
      return {
        status: "error" as const,
        message:
          parsed.error.issues[0]?.message ?? THEME_MESSAGES.INVALID_COLOR,
      };
    }
    const { scope } = parsed.data;
    const color =
      parsed.data.color === null ? null : normalizeHex(parsed.data.color);

    if (parsed.data.color !== null && !color) {
      return {
        status: "error" as const,
        message: THEME_MESSAGES.INVALID_COLOR,
      };
    }

    if (scope === "self") {
      await db
        .update(admins)
        .set({ accentColor: color })
        .where(eq(admins.id, admin.id));
    } else if (color === null) {
      await db.delete(themeSettings).where(eq(themeSettings.scope, scope));
    } else {
      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .insert(themeSettings)
          .values({
            scope,
            accent: color,
            updatedAt: now,
            updatedByAdminId: admin.id,
          })
          .onConflictDoUpdate({
            target: themeSettings.scope,
            set: { accent: color, updatedAt: now, updatedByAdminId: admin.id },
          });
        if (scope === "all") {
          await tx
            .delete(themeSettings)
            .where(inArray(themeSettings.scope, ["trainee", "pt"]));
        }
      });
    }
    updateTag(THEME_CACHE_TAG);
    revalidatePath("/", "layout");
    return { status: "success" as const };
  },
);

const mySchema = z.object({
  color: z.string().max(32, THEME_MESSAGES.INVALID_COLOR).nullable(),
  audience: z.enum(["user", "admin"]).optional(),
});

// Fresh read (not the cache): a lock must take effect on the very next save.
const isRoleLocked = async (scope: LockScope) => {
  const [row] = await db
    .select({ locked: themeLocks.locked })
    .from(themeLocks)
    .where(eq(themeLocks.scope, scope))
    .limit(1);

  return row?.locked ?? false;
};

// Which session the personal color belongs to. The picker page passes its own
// audience; without it the admin session wins, like the rendered color (D11).
const resolveAudience = async (audience: "user" | "admin" | undefined) =>
  audience ??
  ((await readSession(ADMIN_COOKIE))?.role === "admin" ? "admin" : "user");

// Saves (or, with color null, resets) the signed-in person's own app color:
// users.accent_color for a trainee, admins.accent_color for a PT or the super
// admin. Refused while the person's role is locked (the super admin never is).
// A locked role's colors stay in the database and return on unlock.
export const setMyAccentColorAction = withResultErrorHandling(
  "setMyAccentColor",
  async (input: { color: string | null; audience?: "user" | "admin" }) => {
    // The guard comes first, before the input is even parsed.
    const audience = await resolveAudience(
      input?.audience === "user" || input?.audience === "admin"
        ? input.audience
        : undefined,
    );
    const viewer =
      audience === "admin"
        ? { kind: "admin" as const, admin: await requireAdmin() }
        : { kind: "user" as const, user: await requireUser() };
    const parsed = mySchema.safeParse(input);

    if (!parsed.success) {
      return {
        status: "error" as const,
        message:
          parsed.error.issues[0]?.message ?? THEME_MESSAGES.INVALID_COLOR,
      };
    }
    const color =
      parsed.data.color === null ? null : normalizeHex(parsed.data.color);

    if (parsed.data.color !== null && !color) {
      return {
        status: "error" as const,
        message: THEME_MESSAGES.INVALID_COLOR,
      };
    }

    if (viewer.kind === "admin") {
      if (!isSuperAdmin(viewer.admin) && (await isRoleLocked("pt"))) {
        return { status: "error" as const, message: THEME_MESSAGES.LOCKED };
      }
      await db
        .update(admins)
        .set({ accentColor: color })
        .where(eq(admins.id, viewer.admin.id));
    } else {
      if (await isRoleLocked("trainee")) {
        return { status: "error" as const, message: THEME_MESSAGES.LOCKED };
      }
      await db
        .update(users)
        .set({ accentColor: color })
        .where(eq(users.id, viewer.user.id));
    }
    updateTag(THEME_CACHE_TAG);
    revalidatePath("/", "layout");
    return { status: "success" as const };
  },
);

const lockSchema = z.object({
  scope: z.enum(LOCK_SCOPES, THEME_MESSAGES.INVALID_SCOPE),
  locked: z.boolean(),
});

// Turns "no personal app color" on or off for all trainees or all PTs. Super
// admin only. Unlocked is the default and is stored as locked = false.
export const setThemeLockAction = withResultErrorHandling(
  "setThemeLock",
  async (input: { scope: string; locked: boolean }) => {
    const admin = await requireSuperAdmin();
    const parsed = lockSchema.safeParse(input);

    if (!parsed.success) {
      return {
        status: "error" as const,
        message:
          parsed.error.issues[0]?.message ?? THEME_MESSAGES.INVALID_SCOPE,
      };
    }
    const { scope, locked } = parsed.data;
    const now = new Date();

    await db
      .insert(themeLocks)
      .values({ scope, locked, updatedAt: now, updatedByAdminId: admin.id })
      .onConflictDoUpdate({
        target: themeLocks.scope,
        set: { locked, updatedAt: now, updatedByAdminId: admin.id },
      });
    updateTag(THEME_CACHE_TAG);
    revalidatePath("/", "layout");
    return { status: "success" as const };
  },
);
