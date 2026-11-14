"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { RESTRICTION_MESSAGES } from "@/features/restrictions/constants/messages";
import {
  applyRestriction,
  liftRestriction,
} from "@/features/restrictions/services/restriction-mutations";
import {
  blockUserSchema,
  liftRestrictionSchema,
} from "@/features/restrictions/utils/restriction-rules";
import { withResultErrorHandling } from "@/services/action-errors";
import { requireSuperAdmin } from "@/services/auth-guard";
import type { ActionErrorResult } from "@/types/error";
import { getAdminUserPath } from "@/utils/routes";

const fail = (message: string): ActionErrorResult => ({
  status: "error",
  message,
});

// The trainee page, the list badge and the trainee's own screens change.
const refresh = (userId: number) => {
  revalidatePath(ROUTES.ADMIN);
  revalidatePath(getAdminUserPath(userId), "layout");
  revalidatePath("/feed");
};

// Super admin only (a PT is redirected by requireSuperAdmin before anything is
// read). The input is untrusted: a missing trainee or a bad value is refused.
export const blockUserAction = withResultErrorHandling(
  "blockUser",
  async (input: unknown) => {
    const admin = await requireSuperAdmin();
    const parsed = blockUserSchema.safeParse(input);

    if (!parsed.success) {
      return fail(
        parsed.error.issues[0]?.message ?? RESTRICTION_MESSAGES.INVALID_INPUT,
      );
    }
    const result = await applyRestriction(admin.id, parsed.data);

    if (!result.ok) {
      return fail(RESTRICTION_MESSAGES.USER_NOT_FOUND);
    }
    refresh(parsed.data.userId);
  },
);

export const liftRestrictionAction = withResultErrorHandling(
  "liftRestriction",
  async (input: unknown) => {
    const admin = await requireSuperAdmin();
    const parsed = liftRestrictionSchema.safeParse({ userId: input });

    if (!parsed.success) {
      return fail(RESTRICTION_MESSAGES.INVALID_INPUT);
    }
    const result = await liftRestriction(admin.id, parsed.data.userId);

    if (!result.ok) {
      return fail(RESTRICTION_MESSAGES.NOT_RESTRICTED);
    }
    refresh(parsed.data.userId);
  },
);
