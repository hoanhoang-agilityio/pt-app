import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  chatGroupMessageEdits,
  chatGroupMessages,
  chatGroupReactions,
} from "@/db/schema";
import { CHAT_MESSAGES } from "@/features/chat/constants/messages";
import { GROUP_MESSAGES } from "@/features/chat-groups/constants/messages";
import {
  type GroupContext,
  resolveSendBlock,
} from "@/features/chat-groups/services/group-access";
import { deleteGroupPhotoOfMessage } from "@/features/chat-groups/services/group-photos";
import {
  findGroupMessageView,
  findStoredGroupMessage,
  touchGroupMessage,
} from "@/features/chat-groups/services/group-queries";
import { publishGroupUpdate } from "@/features/chat-groups/services/group-realtime";
import type { GroupMessageView } from "@/features/chat-groups/types/group";
import {
  editGroupSchema,
  hideGroupSchema,
  reactGroupSchema,
  unsendGroupSchema,
} from "@/features/chat-groups/utils/group-rules";

// Reaction, edit, unsend and hide for both roles, mirroring chat-mutations.ts
// on the group tables. The caller has already loaded the actor through
// loadGroupActor, so a message of another group is just "not found". Message
// bodies are never logged.

export type GroupMutationResult =
  | { status: "success"; message: GroupMessageView }
  | { status: "error"; message: string };

export type GroupUser = { id: number; chatEnabled: boolean | null } | null;

const fail = (message: string): GroupMutationResult => ({
  status: "error",
  message,
});

const current = async (
  { group, actor }: GroupContext,
  messageId: number,
): Promise<GroupMutationResult> => {
  const message = await findGroupMessageView(group.id, messageId, actor);

  return message
    ? { status: "success", message }
    : fail(CHAT_MESSAGES.MESSAGE_NOT_FOUND);
};

const finish = async (
  context: GroupContext,
  messageId: number,
): Promise<GroupMutationResult> => {
  await touchGroupMessage(context.group.id, messageId);
  await publishGroupUpdate(context.group.id, messageId);
  return current(context, messageId);
};

// A real message the actor may read; system lines and alerts are not
// reactable, editable, unsendable or hideable.
const loadMessage = async (context: GroupContext, messageId: number) => {
  const stored = await findStoredGroupMessage(context.group.id, messageId);

  return stored &&
    stored.kind === "message" &&
    (stored.audience === null || context.actor.isSuperAdmin)
    ? stored
    : null;
};

export const reactToGroupMessage = async (
  context: GroupContext,
  user: GroupUser,
  input: unknown,
): Promise<GroupMutationResult> => {
  const parsed = reactGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  const { messageId, emoji } = parsed.data;
  const block = await resolveSendBlock({
    ...context,
    user,
    ignoreManagersOnly: true,
  });

  if (block) {
    return fail(block.message);
  }
  const stored = await loadMessage(context, messageId);

  if (!stored) {
    return fail(CHAT_MESSAGES.MESSAGE_NOT_FOUND);
  }
  if (stored.deletedAt !== null) {
    return fail(CHAT_MESSAGES.MESSAGE_UNSENT);
  }
  const reactorKey = context.actor.key;
  const [existing] = await db
    .select({ emoji: chatGroupReactions.emoji })
    .from(chatGroupReactions)
    .where(
      and(
        eq(chatGroupReactions.messageId, messageId),
        eq(chatGroupReactions.reactorKey, reactorKey),
      ),
    );

  if (emoji === null || existing?.emoji === emoji) {
    if (!existing) {
      return current(context, messageId);
    }
    await db
      .delete(chatGroupReactions)
      .where(
        and(
          eq(chatGroupReactions.messageId, messageId),
          eq(chatGroupReactions.reactorKey, reactorKey),
        ),
      );
    return finish(context, messageId);
  }
  await db
    .insert(chatGroupReactions)
    .values({ messageId, reactorKey, emoji, createdAt: new Date() })
    .onConflictDoUpdate({
      target: [chatGroupReactions.messageId, chatGroupReactions.reactorKey],
      set: { emoji, createdAt: new Date() },
    });
  return finish(context, messageId);
};

// Own messages only; the previous body is kept for the history sheet.
export const editGroupMessage = async (
  context: GroupContext,
  user: GroupUser,
  input: unknown,
): Promise<GroupMutationResult> => {
  const parsed = editGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  const { messageId, body } = parsed.data;
  const block = await resolveSendBlock({
    ...context,
    user,
    ignoreManagersOnly: true,
  });

  if (block) {
    return fail(block.message);
  }
  const stored = await loadMessage(context, messageId);

  if (!stored) {
    return fail(CHAT_MESSAGES.MESSAGE_NOT_FOUND);
  }
  if (stored.senderKey !== context.actor.key) {
    return fail(CHAT_MESSAGES.NOT_YOUR_MESSAGE);
  }
  if (stored.deletedAt !== null) {
    return fail(CHAT_MESSAGES.MESSAGE_UNSENT);
  }
  if (stored.stickerRef !== null) {
    return fail(CHAT_MESSAGES.STICKER_NOT_EDITABLE);
  }
  // Saving the same text again is not an edit: no history row, no marker.
  if (stored.body === body) {
    return current(context, messageId);
  }
  const editedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(chatGroupMessageEdits)
      .values({ messageId, previousBody: stored.body, editedAt });
    await tx
      .update(chatGroupMessages)
      .set({ body, editedAt })
      .where(eq(chatGroupMessages.id, messageId));
  });
  return finish(context, messageId);
};

// Unsend for everyone: soft delete that drops the text and the photo bytes.
// Idempotent. A restricted trainee may still take their own message back.
export const unsendGroupMessage = async (
  context: GroupContext,
  user: GroupUser,
  input: unknown,
): Promise<GroupMutationResult> => {
  const parsed = unsendGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  const { messageId } = parsed.data;
  const block = await resolveSendBlock({
    ...context,
    user,
    ignoreManagersOnly: true,
    allowRestricted: true,
  });

  if (block) {
    return fail(block.message);
  }
  const stored = await loadMessage(context, messageId);

  if (!stored) {
    return fail(CHAT_MESSAGES.MESSAGE_NOT_FOUND);
  }
  if (stored.senderKey !== context.actor.key) {
    return fail(CHAT_MESSAGES.NOT_YOUR_MESSAGE);
  }
  if (stored.deletedAt !== null) {
    return current(context, messageId);
  }
  await db
    .update(chatGroupMessages)
    .set({
      deletedAt: new Date(),
      body: "",
      stickerRef: null,
      stickerUrl: null,
    })
    .where(eq(chatGroupMessages.id, messageId));
  await deleteGroupPhotoOfMessage(messageId);
  return finish(context, messageId);
};

// A super admin or the creator PT hides (or unhides) anyone's message; the
// text stays stored for moderation, readers see a placeholder.
export const hideGroupMessage = async (
  context: GroupContext,
  user: GroupUser,
  input: unknown,
): Promise<GroupMutationResult> => {
  const parsed = hideGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  if (!context.actor.canManage) {
    return fail(GROUP_MESSAGES.NOT_MANAGER);
  }
  const block = await resolveSendBlock({
    ...context,
    user,
    ignoreManagersOnly: true,
  });

  if (block) {
    return fail(block.message);
  }
  const { messageId, hidden } = parsed.data;
  const stored = await loadMessage(context, messageId);

  if (!stored) {
    return fail(CHAT_MESSAGES.MESSAGE_NOT_FOUND);
  }
  if (hidden === (stored.hiddenAt !== null)) {
    return current(context, messageId);
  }
  await db
    .update(chatGroupMessages)
    .set(
      hidden
        ? { hiddenByKey: context.actor.key, hiddenAt: new Date() }
        : { hiddenByKey: null, hiddenAt: null },
    )
    .where(eq(chatGroupMessages.id, messageId));
  return finish(context, messageId);
};

// The reply target of a new message: a real message of the same group the
// sender may read.
export const isGroupReplyTargetValid = async (
  context: GroupContext,
  replyToMessageId: number | undefined,
) =>
  replyToMessageId === undefined ||
  (await loadMessage(context, replyToMessageId)) !== null;
