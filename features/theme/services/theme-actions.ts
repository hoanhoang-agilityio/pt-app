"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { admins, themeSettings } from "@/db/schema";
import {
  THEME_CACHE_TAG,
  THEME_MESSAGES,
  THEME_SCOPES,
} from "@/features/theme/constants/theme";
import { normalizeHex } from "@/features/theme/utils/color";
import { withResultErrorHandling } from "@/services/action-errors";
import { requireSuperAdmin } from "@/services/auth-guard";

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
