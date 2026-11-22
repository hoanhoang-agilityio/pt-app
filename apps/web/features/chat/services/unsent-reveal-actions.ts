"use server";

import { z } from "zod";

import { CHAT_MESSAGES } from "@/features/chat/constants/messages";
import {
  loadUnsentContent,
  type RevealedUnsent,
} from "@/features/chat/services/unsent-reveal";
import { withResultErrorHandling } from "@/services/action-errors";
import { requireAdmin } from "@/services/auth-guard";
import type { ActionErrorResult } from "@/types/error";
import { isSuperAdmin } from "@/utils/admin-role";

const inputSchema = z
  .object({
    kind: z.enum(["coach", "dm", "group"]),
    messageId: z.number().int().positive(),
    groupId: z.number().int().positive().optional(),
  })
  // A group message is reached through its group.
  .refine((input) => input.kind !== "group" || input.groupId !== undefined);

type RevealResult =
  { status: "success"; content: RevealedUnsent } | ActionErrorResult;

// Super admin only: shows the original of an unsent message in any of the
// three chat systems (coach chat, social DM, group chat). The role check runs
// before anything else; a PT (or anyone else) gets "forbidden" and no call to
// the API. The API checks the role again and only returns a message that was
// really unsent.
export const revealUnsentMessageAction = withResultErrorHandling(
  "revealUnsentMessage",
  async (
    kind: string,
    messageId: number,
    groupId?: number,
  ): Promise<RevealResult> => {
    const admin = await requireAdmin();

    if (!isSuperAdmin(admin)) {
      return { status: "error", message: CHAT_MESSAGES.FORBIDDEN };
    }
    const parsed = inputSchema.safeParse({ kind, messageId, groupId });

    if (!parsed.success) {
      return { status: "error", message: CHAT_MESSAGES.INVALID_INPUT };
    }
    const content = await loadUnsentContent(
      parsed.data.kind,
      parsed.data.messageId,
      parsed.data.groupId,
    );

    if (!content) {
      return { status: "error", message: CHAT_MESSAGES.MESSAGE_NOT_FOUND };
    }
    return { status: "success", content };
  },
);
