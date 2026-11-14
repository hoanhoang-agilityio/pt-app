import "server-only";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  admins,
  chatGroupMembers,
  chatGroupMessages,
  chatGroups,
} from "@/db/schema";
import { AVATAR_MESSAGES } from "@/features/avatar/constants/messages";
import { decodeAvatarDataUrl } from "@/features/avatar/utils/avatar-rules";
import { CHAT_MESSAGES } from "@/features/chat/constants/messages";
import { ownsSticker } from "@/features/chat/services/custom-stickers";
import { parseChatCommand } from "@/features/chat/utils/chat-commands";
import { nextReadCursor } from "@/features/chat/utils/chat-rules";
import {
  type StickerInput,
  toStoredSticker,
} from "@/features/chat/utils/sticker-rules";
import { GROUP_MESSAGES } from "@/features/chat-groups/constants/messages";
import {
  type GroupContext,
  loadGroupActor,
  resolveSendBlock,
} from "@/features/chat-groups/services/group-access";
import {
  type AddMemberResult,
  addMembersToGroup,
  leaveGroup,
  removeMemberFromGroup,
} from "@/features/chat-groups/services/group-membership";
import { isGroupReplyTargetValid } from "@/features/chat-groups/services/group-mutations";
import {
  attachGroupPhotoToMessage,
  isGroupPhotoAttachable,
} from "@/features/chat-groups/services/group-photos";
import { scheduleGroupPush } from "@/features/chat-groups/services/group-push";
import { findGroupMessageByClientId } from "@/features/chat-groups/services/group-queries";
import {
  publishGroupMembers,
  publishGroupMessage,
  publishGroupRead,
} from "@/features/chat-groups/services/group-realtime";
import { appendSystemLine } from "@/features/chat-groups/services/group-system-lines";
import type {
  GroupMessageView,
  GroupSession,
} from "@/features/chat-groups/types/group";
import {
  addMembersSchema,
  createGroupSchema,
  groupIdSchema,
  managersOnlySchema,
  markReadSchema,
  muteSchema,
  removeMemberSchema,
  renameGroupSchema,
  sendGroupSchema,
  sessionKey,
} from "@/features/chat-groups/utils/group-rules";
import { toAdminRole } from "@/services/admin-scope";

// The group operations behind the server actions of both roles. Callers
// (group-actions.ts) have run requireAdmin() / requireUser() and pass the
// session; the group, the role and the rights always come from
// loadGroupActor, never from the client. Message bodies are never logged.

export interface ActionContext {
  session: GroupSession;
  // The signed-in trainee (null for admins), for chat-off and restriction.
  user: { id: number; chatEnabled: boolean | null } | null;
}

export type GroupFailure = { status: "error"; message: string };

const fail = (message: string): GroupFailure => ({ status: "error", message });

type Guarded = { manage?: boolean };

// Loads the actor and applies the common refusals: unknown group, not a
// member, dissolved (a write), and, for management, not allowed to manage.
const withGroup = async <T>(
  ctx: ActionContext,
  groupId: number,
  run: (context: GroupContext) => Promise<T>,
  { manage = false }: Guarded = {},
): Promise<T | GroupFailure> => {
  const context = await loadGroupActor(groupId, ctx.session);

  if (!context || context.group.dissolvedAt !== null) {
    return fail(GROUP_MESSAGES.GROUP_NOT_FOUND);
  }
  if (manage && !context.actor.canManage) {
    return fail(GROUP_MESSAGES.NOT_MANAGER);
  }
  return run(context);
};

export const createGroup = async (ctx: ActionContext, input: unknown) => {
  const parsed = createGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? GROUP_MESSAGES.INVALID_INPUT,
    );
  }
  if (ctx.session.kind !== "admin") {
    return fail(GROUP_MESSAGES.NOT_MANAGER);
  }
  const key = sessionKey(ctx.session);
  const now = new Date();
  const [group] = await db
    .insert(chatGroups)
    .values({ name: parsed.data.name, createdByKey: key, createdAt: now })
    .returning({ id: chatGroups.id });

  // A PT creator is an explicit member (G3); a super admin is implicit.
  if (ctx.session.role === "pt") {
    await db.insert(chatGroupMembers).values({
      groupId: group.id,
      memberKey: key,
      addedByKey: key,
      joinedAt: now,
    });
  }
  const context = await loadGroupActor(group.id, ctx.session);

  if (!context) {
    return fail(GROUP_MESSAGES.GROUP_NOT_FOUND);
  }
  const added = await addMembersToGroup(context, parsed.data);

  return {
    status: "success" as const,
    groupId: group.id,
    results: added.results,
  };
};

export const addGroupMembers = async (ctx: ActionContext, input: unknown) => {
  const parsed = addMembersSchema.safeParse(input);

  if (!parsed.success) {
    return fail(GROUP_MESSAGES.INVALID_INPUT);
  }
  return withGroup(
    ctx,
    parsed.data.groupId,
    async (context) => {
      const { results, added, capReached } = await addMembersToGroup(
        context,
        parsed.data,
      );

      if (added.length === 0 && capReached) {
        return fail(GROUP_MESSAGES.GROUP_FULL);
      }
      return {
        status: "success" as const,
        results: results satisfies AddMemberResult[],
      };
    },
    { manage: true },
  );
};

const isSuperAdminKey = async (memberKey: string) => {
  const [kind, rawId] = memberKey.split(":");

  if (kind !== "admin") {
    return false;
  }
  const [row] = await db
    .select({ role: admins.role })
    .from(admins)
    .where(eq(admins.id, Number(rawId)))
    .limit(1);

  return row ? toAdminRole(row.role) === "super_admin" : false;
};

export const removeGroupMember = async (ctx: ActionContext, input: unknown) => {
  const parsed = removeMemberSchema.safeParse(input);

  if (!parsed.success) {
    return fail(GROUP_MESSAGES.INVALID_INPUT);
  }
  return withGroup(
    ctx,
    parsed.data.groupId,
    async ({ group, actor }) => {
      if (await isSuperAdminKey(parsed.data.memberKey)) {
        return fail(GROUP_MESSAGES.CANNOT_REMOVE_MANAGER);
      }
      return (await removeMemberFromGroup(
        group.id,
        parsed.data.memberKey,
        actor.key,
      ))
        ? { status: "success" as const }
        : fail(GROUP_MESSAGES.MEMBER_NOT_FOUND);
    },
    { manage: true },
  );
};

// A member leaves; a super admin cannot (G2, G7).
export const leaveGroupAsMember = async (
  ctx: ActionContext,
  input: unknown,
) => {
  const parsed = groupIdSchema.safeParse(input);

  if (!parsed.success) {
    return fail(GROUP_MESSAGES.INVALID_INPUT);
  }
  return withGroup(ctx, parsed.data.groupId, async ({ group, actor }) =>
    actor.isSuperAdmin
      ? fail(GROUP_MESSAGES.MANAGER_CANNOT_LEAVE)
      : (await leaveGroup(group.id, actor.key))
        ? { status: "success" as const }
        : fail(GROUP_MESSAGES.GROUP_NOT_FOUND),
  );
};

const touchGroupLine = async (
  groupId: number,
  line: Parameters<typeof appendSystemLine>[1],
) => {
  const lineId = await appendSystemLine(groupId, line);

  await publishGroupMembers(groupId);
  await publishGroupMessage(groupId, lineId);
};

export const renameGroup = async (ctx: ActionContext, input: unknown) => {
  const parsed = renameGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? GROUP_MESSAGES.INVALID_INPUT,
    );
  }
  return withGroup(
    ctx,
    parsed.data.groupId,
    async ({ group, actor }) => {
      // The same name again is not a rename: no line.
      if (group.name !== parsed.data.name) {
        await db
          .update(chatGroups)
          .set({ name: parsed.data.name })
          .where(eq(chatGroups.id, group.id));
        await touchGroupLine(group.id, {
          type: "renamed",
          actorKey: actor.key,
          from: group.name,
          to: parsed.data.name,
        });
      }
      return { status: "success" as const };
    },
    { manage: true },
  );
};

export const setManagersOnly = async (ctx: ActionContext, input: unknown) => {
  const parsed = managersOnlySchema.safeParse(input);

  if (!parsed.success) {
    return fail(GROUP_MESSAGES.INVALID_INPUT);
  }
  return withGroup(
    ctx,
    parsed.data.groupId,
    async ({ group, actor }) => {
      if ((group.managersOnly === true) !== parsed.data.enabled) {
        await db
          .update(chatGroups)
          .set({ managersOnly: parsed.data.enabled })
          .where(eq(chatGroups.id, group.id));
        await touchGroupLine(group.id, {
          type: "managers_only",
          actorKey: actor.key,
          enabled: parsed.data.enabled,
        });
      }
      return { status: "success" as const };
    },
    { manage: true },
  );
};

const avatarInputSchema = z.object({
  groupId: z.number().int().positive(),
  // A validated 256x256 data URL; null removes the photo.
  dataUrl: z.string().max(200_000).nullable(),
});

export const setGroupAvatar = async (ctx: ActionContext, input: unknown) => {
  const parsed = avatarInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail(GROUP_MESSAGES.INVALID_INPUT);
  }
  const { dataUrl } = parsed.data;

  if (dataUrl !== null) {
    const decoded = decodeAvatarDataUrl(dataUrl);

    if (!decoded.ok) {
      return fail(
        decoded.reason === "too-large"
          ? AVATAR_MESSAGES.TOO_LARGE
          : AVATAR_MESSAGES.INVALID,
      );
    }
  }
  return withGroup(
    ctx,
    parsed.data.groupId,
    async ({ group, actor }) => {
      await db
        .update(chatGroups)
        .set(
          dataUrl === null
            ? { avatar: null, avatarUpdatedAt: null }
            : {
                avatar: dataUrl,
                avatarUpdatedAt: new Date(Math.floor(Date.now() / 1000) * 1000),
              },
        )
        .where(eq(chatGroups.id, group.id));
      await touchGroupLine(group.id, {
        type: "avatar_changed",
        actorKey: actor.key,
      });
      return { status: "success" as const };
    },
    { manage: true },
  );
};

// Mute own notifications (any member, incl. a super admin's lazy state row).
export const setGroupMuted = async (ctx: ActionContext, input: unknown) => {
  const parsed = muteSchema.safeParse(input);

  if (!parsed.success) {
    return fail(GROUP_MESSAGES.INVALID_INPUT);
  }
  const context = await loadGroupActor(parsed.data.groupId, ctx.session);

  if (!context) {
    return fail(GROUP_MESSAGES.GROUP_NOT_FOUND);
  }
  const mutedAt = parsed.data.muted ? new Date() : null;

  await db
    .insert(chatGroupMembers)
    .values({
      groupId: context.group.id,
      memberKey: context.actor.key,
      addedByKey: context.actor.key,
      joinedAt: new Date(),
      mutedAt,
    })
    .onConflictDoUpdate({
      target: [chatGroupMembers.groupId, chatGroupMembers.memberKey],
      set: { mutedAt },
    });
  return { status: "success" as const };
};

// Reading stays possible whatever the chat switch or a restriction says. The
// cursor only moves forward and never past the newest message.
export const markGroupRead = async (ctx: ActionContext, input: unknown) => {
  const parsed = markReadSchema.safeParse(input);

  if (!parsed.success) {
    return fail(GROUP_MESSAGES.INVALID_INPUT);
  }
  const context = await loadGroupActor(parsed.data.groupId, ctx.session);

  if (!context) {
    return fail(GROUP_MESSAGES.GROUP_NOT_FOUND);
  }
  const { group, actor } = context;
  const [current] = await db
    .select({ value: chatGroupMembers.lastReadMessageId })
    .from(chatGroupMembers)
    .where(
      sql`${chatGroupMembers.groupId} = ${group.id} and ${chatGroupMembers.memberKey} = ${actor.key}`,
    );
  const next = nextReadCursor(
    current?.value ?? 0,
    parsed.data.lastReadMessageId,
    group.lastMessageId ?? 0,
  );

  await db
    .insert(chatGroupMembers)
    .values({
      groupId: group.id,
      memberKey: actor.key,
      addedByKey: actor.key,
      joinedAt: new Date(),
      lastReadMessageId: next,
    })
    .onConflictDoUpdate({
      target: [chatGroupMembers.groupId, chatGroupMembers.memberKey],
      set: {
        lastReadMessageId: sql`max(${chatGroupMembers.lastReadMessageId}, ${next})`,
      },
    });
  await publishGroupRead(group.id, actor.key, next);
  return { status: "success" as const };
};

// Slash commands only apply to text and photo captions (see chat-actions).
const resolveContent = (parsed: {
  body?: string;
  sticker?: StickerInput;
  photoId?: number;
}) => {
  if (parsed.sticker) {
    return {
      content: { body: "", ...toStoredSticker(parsed.sticker) },
      silent: false,
    };
  }
  const { body, effects } = parseChatCommand(parsed.body ?? "");

  if (!body && parsed.photoId === undefined) {
    return null;
  }
  return {
    content: { body, stickerRef: null, stickerUrl: null },
    silent: effects.silent === true,
  };
};

export type SendGroupResult =
  | { status: "success"; message: GroupMessageView; created: boolean }
  | GroupFailure;

// Send: actor, block reason, Zod, then an insert that is idempotent on
// (group_id, client_id). Push only for a new, non-silent row.
export const sendGroupMessage = async (
  ctx: ActionContext,
  input: unknown,
): Promise<SendGroupResult> => {
  const parsed = sendGroupSchema.safeParse(input);

  if (!parsed.success) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  const { groupId, clientId, replyToMessageId, photoId } = parsed.data;
  const context = await loadGroupActor(groupId, ctx.session);

  if (!context) {
    return fail(GROUP_MESSAGES.GROUP_NOT_FOUND);
  }
  const { group, actor } = context;
  const retried = await findGroupMessageByClientId(group.id, clientId, actor);

  if (retried && retried.senderKey === actor.key) {
    return { status: "success", message: retried, created: false };
  }
  const block = await resolveSendBlock({ ...context, user: ctx.user });

  if (block) {
    return fail(block.message);
  }
  const sticker = parsed.data.sticker;

  if (
    sticker &&
    "customId" in sticker &&
    !(await ownsSticker({ kind: actor.kind, id: actor.id }, sticker.customId))
  ) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  const resolved = resolveContent(parsed.data);

  if (!resolved) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  if (
    photoId !== undefined &&
    !(await isGroupPhotoAttachable(photoId, group.id, actor.key))
  ) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  if (!(await isGroupReplyTargetValid(context, replyToMessageId))) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  const now = new Date();
  const inserted = await db
    .insert(chatGroupMessages)
    .values({
      groupId: group.id,
      kind: "message",
      senderKey: actor.key,
      ...resolved.content,
      photoId: photoId ?? null,
      clientId,
      replyToMessageId: replyToMessageId ?? null,
      silent: resolved.silent ? true : null,
      createdAt: now,
    })
    .onConflictDoNothing({
      target: [chatGroupMessages.groupId, chatGroupMessages.clientId],
    })
    .returning({ id: chatGroupMessages.id });
  const created = inserted.length > 0;

  if (created) {
    await db
      .update(chatGroups)
      .set({ lastMessageId: inserted[0].id, lastMessageAt: now })
      // Two parallel sends must not move the pointer back to the older one.
      .where(
        sql`${chatGroups.id} = ${group.id} and coalesce(${chatGroups.lastMessageId}, 0) < ${inserted[0].id}`,
      );
    if (photoId !== undefined) {
      await attachGroupPhotoToMessage(photoId, inserted[0].id);
    }
  }
  const message = await findGroupMessageByClientId(group.id, clientId, actor);

  if (!message) {
    throw new Error("Group message missing right after insert");
  }
  // A clientId already used by someone else stored nothing for this sender.
  if (message.senderKey !== actor.key) {
    return fail(CHAT_MESSAGES.INVALID_INPUT);
  }
  // After the DB write; publishing never throws. A retried send republishes
  // the stored message, clients dedupe by id.
  await publishGroupMessage(group.id, message.id);
  if (created && !resolved.silent) {
    scheduleGroupPush({
      groupId: group.id,
      senderKey: actor.key,
      body: resolved.content.body,
      ...(sticker ? { sticker: true } : {}),
      ...(photoId === undefined ? {} : { photo: true }),
    });
  }
  return { status: "success", message, created };
};
