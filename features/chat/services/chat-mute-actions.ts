"use server";

import { z } from "zod";

import {
  CHAT_MESSAGES,
  MUTE_MESSAGES,
} from "@/features/chat/constants/messages";
import { clearMute, setMute } from "@/features/chat/services/chat-mutes";
import {
  muteDurationSchema,
  resolveMuteUntil,
  tzOffsetSchema,
} from "@/features/chat/utils/mute-rules";
import {
  adminActorKey,
  userActorKey,
} from "@/features/contact-aliases/utils/alias-rules";
import { withResultErrorHandling } from "@/services/action-errors";
import { isUserInAdminScope } from "@/services/admin-scope";
import { requireAdmin } from "@/services/auth-guard";

// Per-person mute for the signed-in admin. Only trainees (user:<id>) can be
// muted for now; groups are out of scope.

const targetSchema = z.object({
  userId: z.number().int().positive(),
});

const muteSchema = targetSchema.extend({
  duration: muteDurationSchema,
  // Browser Date#getTimezoneOffset(), for "until 08:00 tomorrow".
  tzOffsetMinutes: tzOffsetSchema.optional(),
});

const invalid = () => ({
  status: "error" as const,
  message: MUTE_MESSAGES.INVALID_INPUT,
});

const notFound = () => ({
  status: "error" as const,
  message: CHAT_MESSAGES.USER_NOT_FOUND,
});

// Same answer for a missing trainee and one outside the admin's scope.
const traineeKeyFor = async (adminId: number, userId: number) =>
  (await isUserInAdminScope(adminId, userId)) ? userActorKey(userId) : null;

export const muteContactAction = withResultErrorHandling(
  "muteContact",
  async (input: unknown) => {
    const admin = await requireAdmin();
    const parsed = muteSchema.safeParse(input);

    if (!parsed.success) {
      return invalid();
    }
    const targetKey = await traineeKeyFor(admin.id, parsed.data.userId);

    if (!targetKey) {
      return notFound();
    }
    const until = resolveMuteUntil(
      parsed.data.duration,
      new Date(),
      parsed.data.tzOffsetMinutes,
    );

    await setMute(adminActorKey(admin.id), targetKey, until);
    return { status: "success" as const, until: until?.toISOString() ?? null };
  },
);

export const unmuteContactAction = withResultErrorHandling(
  "unmuteContact",
  async (input: unknown) => {
    const admin = await requireAdmin();
    const parsed = targetSchema.safeParse(input);

    if (!parsed.success) {
      return invalid();
    }
    // Clearing is idempotent and needs no scope check: it only ever touches
    // this admin's own row.
    await clearMute(adminActorKey(admin.id), userActorKey(parsed.data.userId));
    return { status: "success" as const };
  },
);
