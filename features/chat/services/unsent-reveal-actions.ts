"use server";

import { z } from "zod";

import { CHAT_MESSAGES } from "@/features/chat/constants/messages";
import {
  loadUnsentContent,
  type RevealedUnsent,
} from "@/features/chat/services/unsent-reveal";
import { withResultErrorHandling } from "@/services/action-errors";
import { getApiSuperAdmin } from "@/services/auth-guard";
import type { ActionErrorResult } from "@/types/error";

const inputSchema = z.object({
  kind: z.enum(["coach", "dm", "group"]),
  messageId: z.number().int().positive(),
});

type RevealResult =
  { status: "success"; content: RevealedUnsent } | ActionErrorResult;

// Super admin only: shows the original of an unsent message in any of the
// three chat systems (coach chat, social DM, group chat). The role check is
// the first thing that runs, before any message query; everyone else gets
// "forbidden". Only a message with deleted_at set is returned.
export const revealUnsentMessageAction = withResultErrorHandling(
  "revealUnsentMessage",
  async (kind: string, messageId: number): Promise<RevealResult> => {
    const admin = await getApiSuperAdmin();

    if (!admin) {
      return { status: "error", message: CHAT_MESSAGES.FORBIDDEN };
    }
    const input = inputSchema.parse({ kind, messageId });
    const content = await loadUnsentContent(input.kind, input.messageId);

    if (!content) {
      return { status: "error", message: CHAT_MESSAGES.MESSAGE_NOT_FOUND };
    }
    return { status: "success", content };
  },
);
