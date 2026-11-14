import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { chatGroupMembers, chatGroups } from "@/db/schema";
import { CHAT_MESSAGES } from "@/features/chat/constants/messages";
import { GROUP_MESSAGES } from "@/features/chat-groups/constants/messages";
import type {
  GroupActor,
  GroupSession,
} from "@/features/chat-groups/types/group";
import {
  buildGroupActor,
  groupSendBlockReason,
  parseGroupId,
  type SendBlockReason,
  sessionKey,
} from "@/features/chat-groups/utils/group-rules";
import { restrictionErrorFor } from "@/features/restrictions/services/restriction-guard";
import { toAdminRole } from "@/services/admin-scope";

export type GroupRow = typeof chatGroups.$inferSelect;
export type GroupMemberRow = typeof chatGroupMembers.$inferSelect;

export interface GroupContext {
  group: GroupRow;
  actor: GroupActor;
}

export const sessionOfUser = (user: { id: number }): GroupSession => ({
  kind: "user",
  id: user.id,
});

export const sessionOfAdmin = (admin: {
  id: number;
  role: string | null | undefined;
}): GroupSession => ({
  kind: "admin",
  id: admin.id,
  role: toAdminRole(admin.role),
});

export const findGroupById = async (groupId: number) => {
  const [row] = await db
    .select()
    .from(chatGroups)
    .where(eq(chatGroups.id, groupId))
    .limit(1);

  return row ?? null;
};

export const findMemberRow = async (groupId: number, memberKey: string) => {
  const [row] = await db
    .select()
    .from(chatGroupMembers)
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        eq(chatGroupMembers.memberKey, memberKey),
      ),
    )
    .limit(1);

  return row ?? null;
};

// The only door to a group for reads, mutations, API routes, photos, avatar
// and the Ably token. Null for a bad id, a missing group, a dissolved group
// (except for a super admin), a non-member and a left member: all answer
// "not found", so ids cannot be probed.
export const loadGroupActor = async (
  groupId: unknown,
  session: GroupSession,
): Promise<GroupContext | null> => {
  const id = parseGroupId(groupId);

  if (id === null) {
    return null;
  }
  const group = await findGroupById(id);

  if (!group) {
    return null;
  }
  const actor = buildGroupActor({
    session,
    group,
    member: await findMemberRow(id, sessionKey(session)),
  });

  return actor ? { group, actor } : null;
};

// The single place that knows how the block-user feature is asked. Returns
// the error to answer with when the trainee is restricted, or null.
export const loadTraineeRestriction = (userId: number) =>
  restrictionErrorFor(userId);

export interface SendBlock {
  reason: SendBlockReason;
  message: string;
}

const messageFor = (reason: SendBlockReason, restricted: string | null) => {
  switch (reason) {
    case "managers_only":
      return GROUP_MESSAGES.MANAGERS_ONLY;
    case "chat_off":
      return CHAT_MESSAGES.CHAT_LOCKED;
    case "restricted":
      return restricted ?? GROUP_MESSAGES.GROUP_NOT_FOUND;
    case "dissolved":
    case "left":
      return GROUP_MESSAGES.GROUP_NOT_FOUND;
  }
};

// Why this actor may not write into the group right now, or null. Reading is
// never blocked here. `user` is the signed-in trainee (null for admins).
// A restricted trainee can still unsend (`allowRestricted`), like the coach
// chat; reactions and edits stay possible under managers-only.
export const resolveSendBlock = async ({
  group,
  actor,
  user,
  ignoreManagersOnly = false,
  allowRestricted = false,
}: {
  group: GroupRow;
  actor: GroupActor;
  user: { id: number; chatEnabled: boolean | null } | null;
  ignoreManagersOnly?: boolean;
  allowRestricted?: boolean;
}): Promise<SendBlock | null> => {
  const restricted =
    actor.kind === "user" && user && !allowRestricted
      ? await loadTraineeRestriction(user.id)
      : null;
  const reason = groupSendBlockReason({
    actor,
    dissolved: group.dissolvedAt !== null,
    managersOnly: group.managersOnly === true,
    chatEnabled: user?.chatEnabled === true,
    restricted: restricted !== null,
    ignoreManagersOnly,
  });

  return reason ? { reason, message: messageFor(reason, restricted) } : null;
};
