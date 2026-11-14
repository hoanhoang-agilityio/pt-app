import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { touchMessage } from "@/features/chat/services/chat-queries";
import { publishMessageUpdate } from "@/features/chat/services/chat-realtime";

// Admin moderation: hides one message for everybody. Readers treat a hidden
// message like an unsent one (no body, sticker, photo, reactions or quote);
// the row (and a photo's bytes) stays, so the report keeps its evidence. Idempotent:
// hiding twice keeps the first admin. `hidden: false` means the message does
// not exist (or was unsent already, so there is nothing left to hide).
export const hideMessageByAdmin = async (
  adminId: number,
  messageId: number,
): Promise<{ hidden: boolean }> => {
  const [stored] = await db
    .select({
      id: chatMessages.id,
      conversationId: chatMessages.conversationId,
      deletedAt: chatMessages.deletedAt,
      hiddenByAdminId: chatMessages.hiddenByAdminId,
    })
    .from(chatMessages)
    .where(eq(chatMessages.id, messageId))
    .limit(1);

  if (!stored || stored.deletedAt !== null) {
    return { hidden: false };
  }
  if (stored.hiddenByAdminId !== null) {
    return { hidden: true };
  }
  await db
    .update(chatMessages)
    .set({ hiddenByAdminId: adminId, replyPostId: null })
    .where(
      and(eq(chatMessages.id, messageId), isNull(chatMessages.hiddenByAdminId)),
    );
  await touchMessage(stored.conversationId, messageId);
  await publishMessageUpdate(stored.conversationId, messageId);
  return { hidden: true };
};
