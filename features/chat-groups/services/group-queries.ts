import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  admins,
  chatGroupMembers,
  chatGroupMessageEdits,
  chatGroupMessages,
  chatGroupPhotos,
  chatGroupReactions,
  chatGroups,
} from "@/db/schema";
import {
  CHANGES_PAGE_SIZE,
  toPreview,
  toReplySnippet,
} from "@/features/chat/utils/chat-rules";
import { GROUP_PAGE_SIZE } from "@/features/chat-groups/constants/limits";
import type { GroupRow } from "@/features/chat-groups/services/group-access";
import { loadShownNames } from "@/features/chat-groups/services/group-names";
import type {
  GroupActor,
  GroupLastMessage,
  GroupMemberView,
  GroupMessageView,
  GroupSenderTag,
  GroupSession,
  GroupSummary,
} from "@/features/chat-groups/types/group";
import { sessionKey } from "@/features/chat-groups/utils/group-rules";
import { seenByKeys } from "@/features/chat-groups/utils/group-unread";
import {
  parseSystemEvent,
  systemEventKeys,
} from "@/features/chat-groups/utils/system-event";

const messages = chatGroupMessages;

// Rows with `audience = 'super_admin'` (the PT-change alert) exist for super
// admins only: this is the one filter every thread query goes through.
export const audienceFilter = (actor: Pick<GroupActor, "isSuperAdmin">) =>
  actor.isSuperAdmin ? undefined : isNull(messages.audience);

// Explicit members that count for the cap and the member list: active rows
// minus the lazy state rows of super admins.
const SUPER_ADMIN_KEYS = sql`(select 'admin:' || id from admins where role is null or role = 'super_admin')`;

export const explicitActiveFilter = (groupId: number) =>
  and(
    eq(chatGroupMembers.groupId, groupId),
    isNull(chatGroupMembers.leftAt),
    sql`${chatGroupMembers.memberKey} not in ${SUPER_ADMIN_KEYS}`,
  );

type Executor = Pick<typeof db, "select">;

export const countExplicitMembers = async (
  groupId: number,
  executor: Executor = db,
) => {
  const [row] = await executor
    .select({ total: count() })
    .from(chatGroupMembers)
    .where(explicitActiveFilter(groupId));

  return row?.total ?? 0;
};

export const listSuperAdminIds = async () => {
  const rows = await db
    .select({ id: admins.id })
    .from(admins)
    .where(or(isNull(admins.role), eq(admins.role, "super_admin")));

  return rows.map((row) => row.id);
};

// ---- thread -------------------------------------------------------------

const messageColumns = {
  id: messages.id,
  groupId: messages.groupId,
  kind: messages.kind,
  senderKey: messages.senderKey,
  body: messages.body,
  systemEvent: messages.systemEvent,
  audience: messages.audience,
  clientId: messages.clientId,
  replyToMessageId: messages.replyToMessageId,
  stickerRef: messages.stickerRef,
  stickerUrl: messages.stickerUrl,
  photoId: messages.photoId,
  silent: messages.silent,
  deletedAt: messages.deletedAt,
  hiddenAt: messages.hiddenAt,
  editedAt: messages.editedAt,
  updatedAt: messages.updatedAt,
  createdAt: messages.createdAt,
};

type MessageRow = Pick<
  typeof chatGroupMessages.$inferSelect,
  keyof typeof messageColumns
>;

// The reader cursors of the people who count for "Seen by": every active
// member row (explicit members and the state rows of super admins).
export const listReaderCursors = async (groupId: number) =>
  db
    .select({
      memberKey: chatGroupMembers.memberKey,
      lastReadMessageId: chatGroupMembers.lastReadMessageId,
    })
    .from(chatGroupMembers)
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        isNull(chatGroupMembers.leftAt),
      ),
    );

const senderTagOf = (
  role: "super_admin" | "pt" | "trainee" | undefined,
): GroupSenderTag | null =>
  role === "super_admin" ? "manager" : role === "pt" ? "pt" : null;

const hydrateMessages = async (
  rows: MessageRow[],
  groupId: number,
  actor: GroupActor,
): Promise<GroupMessageView[]> => {
  // Defence in depth: the query already filtered, but an alert must never
  // leave this module for a non super admin.
  const visible = rows.filter(
    (row) => row.audience === null || actor.isSuperAdmin,
  );

  if (visible.length === 0) {
    return [];
  }
  const ids = visible.map((row) => row.id);
  const replyIds = [
    ...new Set(
      visible.flatMap((row) =>
        row.replyToMessageId === null ? [] : [row.replyToMessageId],
      ),
    ),
  ];
  const photoIds = visible.flatMap((row) =>
    row.photoId !== null && row.deletedAt === null && row.hiddenAt === null
      ? [row.photoId]
      : [],
  );
  const events = new Map(
    visible.flatMap((row) => {
      const event =
        row.kind === "system" ? parseSystemEvent(row.systemEvent) : null;

      return event ? [[row.id, event] as const] : [];
    }),
  );
  const [reactionRows, replyRows, cursors, photoRows] = await Promise.all([
    db
      .select()
      .from(chatGroupReactions)
      .where(inArray(chatGroupReactions.messageId, ids)),
    replyIds.length
      ? db
          .select({
            id: messages.id,
            senderKey: messages.senderKey,
            body: messages.body,
            kind: messages.kind,
            audience: messages.audience,
            deletedAt: messages.deletedAt,
            hiddenAt: messages.hiddenAt,
            stickerRef: messages.stickerRef,
            photoId: messages.photoId,
          })
          .from(messages)
          .where(
            and(
              inArray(messages.id, replyIds),
              eq(messages.groupId, groupId),
              audienceFilter(actor),
            ),
          )
      : [],
    visible.some((row) => row.senderKey === actor.key)
      ? listReaderCursors(groupId)
      : [],
    photoIds.length
      ? db
          .select({
            id: chatGroupPhotos.id,
            width: chatGroupPhotos.width,
            height: chatGroupPhotos.height,
          })
          .from(chatGroupPhotos)
          .where(inArray(chatGroupPhotos.id, photoIds))
      : [],
  ]);
  const { nameOf, identities } = await loadShownNames(actor.key, [
    ...[...events.values()].flatMap(systemEventKeys),
    ...visible.flatMap((row) => (row.senderKey ? [row.senderKey] : [])),
    ...replyRows.flatMap((row) => (row.senderKey ? [row.senderKey] : [])),
  ]);
  const replies = new Map(replyRows.map((row) => [row.id, row]));
  const photoSizes = new Map(photoRows.map((row) => [row.id, row]));

  return visible.map((row): GroupMessageView => {
    const deleted = row.deletedAt !== null;
    const hidden = row.hiddenAt !== null;
    const showContent = !deleted && !hidden;
    const reply =
      row.replyToMessageId === null
        ? null
        : (replies.get(row.replyToMessageId) ?? null);
    const mine = reactionRows.filter((r) => r.messageId === row.id);
    // Most used first, ties in a stable (alphabetical) order.
    const counts = new Map<string, number>();

    for (const reaction of mine) {
      counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
    }
    const emojis = [...counts.keys()].sort(
      (a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b),
    );

    return {
      id: row.id,
      groupId: row.groupId,
      kind: row.kind,
      senderKey: row.senderKey,
      senderName: row.senderKey ? nameOf(row.senderKey) : null,
      senderDeleted: row.senderKey !== null && !identities.has(row.senderKey),
      senderTag: row.senderKey
        ? senderTagOf(identities.get(row.senderKey)?.role)
        : null,
      body: showContent ? row.body : "",
      systemEvent:
        row.kind === "system" ? parseSystemEvent(row.systemEvent) : null,
      audience: row.audience,
      clientId: row.clientId,
      replyTo: reply
        ? {
            id: reply.id,
            senderKey: reply.senderKey,
            senderName: reply.senderKey ? nameOf(reply.senderKey) : null,
            snippet:
              reply.deletedAt === null && reply.hiddenAt === null
                ? toReplySnippet(reply.body)
                : "",
            unavailable: reply.deletedAt !== null || reply.hiddenAt !== null,
            isSticker:
              reply.deletedAt === null &&
              reply.hiddenAt === null &&
              reply.stickerRef !== null,
            isPhoto:
              reply.deletedAt === null &&
              reply.hiddenAt === null &&
              reply.photoId !== null,
          }
        : null,
      sticker:
        showContent && row.stickerRef && row.stickerUrl
          ? { ref: row.stickerRef, url: row.stickerUrl }
          : null,
      photoId: showContent ? row.photoId : null,
      photo:
        showContent && row.photoId !== null && photoSizes.has(row.photoId)
          ? {
              id: row.photoId,
              width: photoSizes.get(row.photoId)!.width,
              height: photoSizes.get(row.photoId)!.height,
            }
          : null,
      eventNames: Object.fromEntries(
        (events.has(row.id) ? systemEventKeys(events.get(row.id)!) : []).map(
          (key) => [key, nameOf(key)],
        ),
      ),
      silent: row.silent === true,
      deleted,
      hidden,
      edited: row.editedAt !== null && !deleted,
      reactions: deleted
        ? []
        : emojis.map((emoji) => ({
            emoji,
            count: mine.filter((r) => r.emoji === emoji).length,
            mine: mine.some(
              (r) => r.emoji === emoji && r.reactorKey === actor.key,
            ),
          })),
      seenCount:
        row.kind === "message" && row.senderKey === actor.key
          ? seenByKeys(row, cursors).length
          : 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
};

export interface ListGroupMessagesOptions {
  after?: number;
  before?: number;
}

// `after`: newer than the cursor, oldest first (polling). `before` or
// nothing: the newest page older than the cursor, oldest first.
export const listGroupMessages = async (
  groupId: number,
  actor: GroupActor,
  { after, before }: ListGroupMessagesOptions = {},
) => {
  const forward = after !== undefined;
  const cursorFilter =
    after !== undefined
      ? gt(messages.id, after)
      : before !== undefined
        ? lt(messages.id, before)
        : undefined;
  const rows = await db
    .select(messageColumns)
    .from(messages)
    .where(
      and(eq(messages.groupId, groupId), audienceFilter(actor), cursorFilter),
    )
    .orderBy(forward ? asc(messages.id) : desc(messages.id))
    .limit(GROUP_PAGE_SIZE + 1);
  const page = rows.slice(0, GROUP_PAGE_SIZE);

  return {
    messages: await hydrateMessages(
      forward ? page : page.reverse(),
      groupId,
      actor,
    ),
    hasMore: rows.length > GROUP_PAGE_SIZE,
  };
};

// Messages edited, unsent, reacted to or hidden after `changedSince` (epoch
// ms), oldest change first; same paging rule as the coach chat.
export const listGroupChanges = async (
  groupId: number,
  actor: GroupActor,
  changedSince: number,
  lastChangeAt: number,
) => {
  const rows = await db
    .select(messageColumns)
    .from(messages)
    .where(
      and(
        eq(messages.groupId, groupId),
        audienceFilter(actor),
        gt(messages.updatedAt, new Date(changedSince)),
      ),
    )
    .orderBy(asc(messages.updatedAt), asc(messages.id))
    .limit(CHANGES_PAGE_SIZE + 1);
  const truncated = rows.length > CHANGES_PAGE_SIZE;
  const page = rows.slice(0, CHANGES_PAGE_SIZE);

  return {
    changes: await hydrateMessages(page, groupId, actor),
    lastChangeAt: truncated
      ? (page[page.length - 1].updatedAt?.getTime() ?? lastChangeAt)
      : lastChangeAt,
  };
};

export interface GroupThreadPayload {
  messages: GroupMessageView[];
  hasMore: boolean;
  changes: GroupMessageView[];
  lastChangeAt: number;
  group: {
    id: number;
    name: string;
    avatarVersion: number | null;
    managersOnly: boolean;
    dissolved: boolean;
  };
}

export const avatarVersionOf = (group: Pick<GroupRow, "avatarUpdatedAt">) =>
  group.avatarUpdatedAt
    ? Math.floor(group.avatarUpdatedAt.getTime() / 1000)
    : null;

export const loadGroupThread = async (
  group: GroupRow,
  actor: GroupActor,
  query: ListGroupMessagesOptions,
  changedSince: number | undefined,
): Promise<GroupThreadPayload> => {
  const lastChangeAt = group.lastChangeAt?.getTime() ?? 0;
  const [page, changed] = await Promise.all([
    listGroupMessages(group.id, actor, query),
    changedSince === undefined
      ? { changes: [] as GroupMessageView[], lastChangeAt }
      : listGroupChanges(group.id, actor, changedSince, lastChangeAt),
  ]);

  return {
    ...page,
    ...changed,
    group: {
      id: group.id,
      name: group.name,
      avatarVersion: avatarVersionOf(group),
      managersOnly: group.managersOnly === true,
      dissolved: group.dissolvedAt !== null,
    },
  };
};

export const findStoredGroupMessage = async (
  groupId: number,
  messageId: number,
) => {
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.groupId, groupId)))
    .limit(1);

  return row ?? null;
};

// One message as this actor sees it; null when it is not in the group or is
// an alert the actor may not read.
export const findGroupMessageView = async (
  groupId: number,
  messageId: number,
  actor: GroupActor,
) => {
  const rows = await db
    .select(messageColumns)
    .from(messages)
    .where(
      and(
        eq(messages.id, messageId),
        eq(messages.groupId, groupId),
        audienceFilter(actor),
      ),
    )
    .limit(1);

  return (await hydrateMessages(rows, groupId, actor))[0] ?? null;
};

// A retried send (same clientId) finds the stored message.
export const findGroupMessageByClientId = async (
  groupId: number,
  clientId: string,
  actor: GroupActor,
) => {
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.groupId, groupId), eq(messages.clientId, clientId)))
    .limit(1);

  return row ? findGroupMessageView(groupId, row.id, actor) : null;
};

// Moves the group's change cursor (strictly increasing) so a change in the
// same millisecond as a poll is never lost.
export const bumpGroupChange = async (groupId: number) => {
  const [row] = await db
    .update(chatGroups)
    .set({
      lastChangeAt: sql`max(coalesce(${chatGroups.lastChangeAt}, 0) + 1, ${Date.now()})`,
    })
    .where(eq(chatGroups.id, groupId))
    .returning({ lastChangeAt: chatGroups.lastChangeAt });

  return row?.lastChangeAt ?? new Date();
};

export const touchGroupMessage = async (groupId: number, messageId: number) => {
  const changedAt = await bumpGroupChange(groupId);

  await db
    .update(messages)
    .set({ updatedAt: changedAt })
    .where(eq(messages.id, messageId));
  return changedAt;
};

// Previous bodies, oldest first; null when the message is not in the group
// (or an alert the actor may not read); an unsent message shows none.
export const loadGroupEditHistory = async (
  groupId: number,
  messageId: number,
  actor: GroupActor,
) => {
  const stored = await findStoredGroupMessage(groupId, messageId);

  if (
    !stored ||
    stored.kind !== "message" ||
    (stored.audience !== null && !actor.isSuperAdmin)
  ) {
    return null;
  }
  if (stored.deletedAt !== null || stored.hiddenAt !== null) {
    return [];
  }
  return db
    .select({
      id: chatGroupMessageEdits.id,
      previousBody: chatGroupMessageEdits.previousBody,
      editedAt: chatGroupMessageEdits.editedAt,
    })
    .from(chatGroupMessageEdits)
    .where(eq(chatGroupMessageEdits.messageId, messageId))
    .orderBy(asc(chatGroupMessageEdits.id));
};

// ---- members ------------------------------------------------------------

// Explicit active members plus every super admin (implicit), labelled by
// role. One helper for the member list, the seen-by sheet and push.
export const listGroupMemberKeys = async (groupId: number) => {
  const [explicit, superIds] = await Promise.all([
    db
      .select({ memberKey: chatGroupMembers.memberKey })
      .from(chatGroupMembers)
      .where(explicitActiveFilter(groupId)),
    listSuperAdminIds(),
  ]);

  return [
    ...new Set([
      ...superIds.map((id) => `admin:${id}`),
      ...explicit.map((row) => row.memberKey),
    ]),
  ];
};

export const listGroupMembers = async (
  group: GroupRow,
  actor: GroupActor,
): Promise<GroupMemberView[]> => {
  const keys = await listGroupMemberKeys(group.id);
  const { identities, nameOf } = await loadShownNames(actor.key, keys);

  return keys.flatMap((key) => {
    const identity = identities.get(key);
    const [kind, rawId] = key.split(":");

    return identity
      ? [
          {
            key,
            kind: kind as "user" | "admin",
            id: Number(rawId),
            role: identity.role,
            name: nameOf(key) ?? identity.name,
            isCreator: key === group.createdByKey,
          },
        ]
      : [];
  });
};

// Who read up to a message of the actor's group, never the sender. Null when
// the message is not a readable message of this group.
export const listSeenBy = async (
  groupId: number,
  messageId: number,
  actor: GroupActor,
) => {
  const stored = await findStoredGroupMessage(groupId, messageId);

  if (!stored || stored.kind !== "message" || stored.audience !== null) {
    return null;
  }
  const keys = seenByKeys(stored, await listReaderCursors(groupId));
  const { identities, nameOf } = await loadShownNames(actor.key, keys);

  return keys.flatMap((key) => {
    const identity = identities.get(key);

    return identity
      ? [{ key, role: identity.role, name: nameOf(key) ?? identity.name }]
      : [];
  });
};

// ---- inbox and unread ---------------------------------------------------

const baselineOf = async (session: GroupSession) => {
  if (session.kind !== "admin" || session.role !== "super_admin") {
    return null;
  }
  const [row] = await db
    .select({ createdAt: admins.createdAt })
    .from(admins)
    .where(eq(admins.id, session.id))
    .limit(1);

  return row?.createdAt ?? null;
};

// Groups this person sees in their list: a super admin every group that is
// not dissolved, everyone else their active memberships.
const loadVisibleGroups = async (session: GroupSession) => {
  const key = sessionKey(session);

  if (session.kind === "admin" && session.role === "super_admin") {
    return db.select().from(chatGroups).where(isNull(chatGroups.dissolvedAt));
  }
  const rows = await db
    .select({ group: chatGroups })
    .from(chatGroups)
    .innerJoin(
      chatGroupMembers,
      and(
        eq(chatGroupMembers.groupId, chatGroups.id),
        eq(chatGroupMembers.memberKey, key),
        isNull(chatGroupMembers.leftAt),
      ),
    )
    .where(isNull(chatGroups.dissolvedAt));

  return rows.map((row) => row.group);
};

// Same predicate as isUnreadFor (utils/group-unread.ts).
const unreadByGroup = async (
  session: GroupSession,
  groupIds: number[],
): Promise<Map<number, number>> => {
  if (groupIds.length === 0) {
    return new Map();
  }
  const key = sessionKey(session);
  const baseline = await baselineOf(session);
  const rows = await db
    .select({ groupId: messages.groupId, unread: count() })
    .from(messages)
    .leftJoin(
      chatGroupMembers,
      and(
        eq(chatGroupMembers.groupId, messages.groupId),
        eq(chatGroupMembers.memberKey, key),
      ),
    )
    .where(
      and(
        inArray(messages.groupId, groupIds),
        eq(messages.kind, "message"),
        isNull(messages.audience),
        isNull(messages.deletedAt),
        isNull(messages.hiddenAt),
        sql`coalesce(${messages.senderKey}, '') <> ${key}`,
        gt(
          messages.id,
          sql`coalesce(${chatGroupMembers.lastReadMessageId}, 0)`,
        ),
        baseline ? gte(messages.createdAt, baseline) : undefined,
      ),
    )
    .groupBy(messages.groupId);

  return new Map(rows.map((row) => [row.groupId, row.unread]));
};

// Badge poll: total and per group; system lines and alerts never count, mute
// does not change it.
export const countGroupUnread = async (session: GroupSession) => {
  const groups = await loadVisibleGroups(session);
  const unread = await unreadByGroup(
    session,
    groups.map((group) => group.id),
  );
  const perGroup = groups
    .map((group) => ({ groupId: group.id, unread: unread.get(group.id) ?? 0 }))
    .filter((row) => row.unread > 0);

  return {
    total: perGroup.reduce((sum, row) => sum + row.unread, 0),
    perGroup,
  };
};

const toLastMessage = (row: {
  id: number;
  kind: "message" | "system";
  senderKey: string | null;
  body: string;
  systemEvent: string | null;
  deletedAt: Date | null;
  hiddenAt: Date | null;
  stickerRef: string | null;
  photoId: number | null;
  createdAt: Date;
}): GroupLastMessage => ({
  id: row.id,
  kind: row.kind,
  senderKey: row.senderKey,
  // Unsent and hidden text never reaches the inbox; photos and stickers have
  // no text, the UI shows its own label for them.
  preview:
    row.kind === "message" && row.deletedAt === null && row.hiddenAt === null
      ? toPreview(row.body)
      : "",
  media:
    row.kind === "message" && row.deletedAt === null && row.hiddenAt === null
      ? row.photoId !== null
        ? "photo"
        : row.stickerRef !== null
          ? "sticker"
          : null
      : null,
  systemEvent: row.kind === "system" ? parseSystemEvent(row.systemEvent) : null,
  createdAt: row.createdAt,
});

export const listGroupsForSession = async (
  session: GroupSession,
): Promise<GroupSummary[]> => {
  const key = sessionKey(session);
  const groups = await loadVisibleGroups(session);

  if (groups.length === 0) {
    return [];
  }
  const ids = groups.map((group) => group.id);
  const lastIds = groups.flatMap((group) =>
    group.lastMessageId === null ? [] : [group.lastMessageId],
  );
  const isSuper = session.kind === "admin" && session.role === "super_admin";
  const [unread, states, lastRows] = await Promise.all([
    unreadByGroup(session, ids),
    db
      .select({
        groupId: chatGroupMembers.groupId,
        mutedAt: chatGroupMembers.mutedAt,
      })
      .from(chatGroupMembers)
      .where(
        and(
          inArray(chatGroupMembers.groupId, ids),
          eq(chatGroupMembers.memberKey, key),
        ),
      ),
    lastIds.length
      ? db
          .select({
            id: messages.id,
            kind: messages.kind,
            senderKey: messages.senderKey,
            body: messages.body,
            systemEvent: messages.systemEvent,
            deletedAt: messages.deletedAt,
            hiddenAt: messages.hiddenAt,
            stickerRef: messages.stickerRef,
            photoId: messages.photoId,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(
            and(
              inArray(messages.id, lastIds),
              isSuper ? undefined : isNull(messages.audience),
            ),
          )
      : [],
  ]);
  const muted = new Map(states.map((row) => [row.groupId, row.mutedAt]));
  const last = new Map(lastRows.map((row) => [row.id, toLastMessage(row)]));
  const summaries = groups.map((group): GroupSummary => ({
    id: group.id,
    name: group.name,
    avatarVersion: avatarVersionOf(group),
    managersOnly: group.managersOnly === true,
    muted: Boolean(muted.get(group.id)),
    unread: unread.get(group.id) ?? 0,
    canManage:
      isSuper || (session.kind === "admin" && group.createdByKey === key),
    dissolved: group.dissolvedAt !== null,
    lastMessage:
      group.lastMessageId === null
        ? null
        : (last.get(group.lastMessageId) ?? null),
    lastMessageAt: group.lastMessageAt,
  }));

  return summaries.sort(
    (a, b) =>
      (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0) ||
      b.id - a.id,
  );
};
