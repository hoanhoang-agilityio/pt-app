import { z } from "zod";

import {
  editSchema,
  hasBodyOrSticker,
  reactSchema,
  sendMessageShape,
  unsendSchema,
} from "@/features/chat/utils/chat-rules";
import {
  GROUP_MEMBER_CAP,
  GROUP_NAME_MAX_LENGTH,
  GROUP_NAME_MIN_LENGTH,
} from "@/features/chat-groups/constants/limits";
import { GROUP_MESSAGES } from "@/features/chat-groups/constants/messages";
import type {
  GroupActor,
  GroupRole,
  GroupSession,
} from "@/features/chat-groups/types/group";
import {
  adminActorKey,
  userActorKey,
} from "@/features/contact-aliases/utils/alias-rules";

const id = z.number().int().positive();

// Ids come from URLs and bodies: only positive safe integers are real.
export const parseGroupId = (value: unknown): number | null => {
  const parsed = z.coerce.number().int().positive().safeParse(value);

  return parsed.success && Number.isSafeInteger(parsed.data)
    ? parsed.data
    : null;
};

// Trimmed, inner whitespace collapsed, 1..60 characters (not UTF-16 units).
export const groupNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .refine((value) => {
    const length = Array.from(value).length;

    return (
      length >= GROUP_NAME_MIN_LENGTH &&
      length <= GROUP_NAME_MAX_LENGTH &&
      !/\p{Cc}/u.test(value)
    );
  }, GROUP_MESSAGES.NAME_INVALID);

// Ids stay unvalidated here on purpose: a bad id is skipped with its own
// result by the add action instead of failing the whole request.
const memberIds = z.array(z.unknown()).max(GROUP_MEMBER_CAP * 2);

export const createGroupSchema = z.object({
  name: groupNameSchema,
  userIds: memberIds.default([]),
  ptIds: memberIds.default([]),
});

export const addMembersSchema = z.object({
  groupId: id,
  userIds: memberIds.default([]),
  ptIds: memberIds.default([]),
});

export const memberKeySchema = z.string().regex(/^(user|admin):[1-9]\d{0,14}$/);

export const removeMemberSchema = z.object({
  groupId: id,
  memberKey: memberKeySchema,
});

export const groupIdSchema = z.object({ groupId: id });
export const renameGroupSchema = z.object({
  groupId: id,
  name: groupNameSchema,
});
export const managersOnlySchema = z.object({
  groupId: id,
  enabled: z.boolean(),
});
export const muteSchema = z.object({ groupId: id, muted: z.boolean() });
export const markReadSchema = z.object({
  groupId: id,
  lastReadMessageId: z.number().int().nonnegative(),
});

export const sendGroupSchema = sendMessageShape
  .omit({ postId: true })
  .extend({ groupId: id })
  .refine(hasBodyOrSticker);
export const reactGroupSchema = reactSchema.extend({ groupId: id });
export const editGroupSchema = editSchema.extend({ groupId: id });
export const unsendGroupSchema = unsendSchema.extend({ groupId: id });
export const hideGroupSchema = z.object({
  groupId: id,
  messageId: id,
  hidden: z.boolean(),
});
export const resolveAlertSchema = z.object({
  groupId: id,
  messageId: id,
  choice: z.enum(["keep", "remove"]),
});

export const sessionKey = (session: GroupSession) =>
  session.kind === "user"
    ? userActorKey(session.id)
    : adminActorKey(session.id);

export interface GroupAccessInput {
  session: GroupSession;
  group: { createdByKey: string; dissolvedAt: Date | null };
  // The member row of this person; null = none.
  member: { leftAt: Date | null } | null;
}

// The actor of a request, or null when the group must answer "not found":
// a super admin is always in (even a dissolved group, read-only); everyone
// else needs an active member row in a group that is not dissolved. Missing
// group, dissolved, non-member and left member are indistinguishable.
export const buildGroupActor = ({
  session,
  group,
  member,
}: GroupAccessInput): GroupActor | null => {
  const key = sessionKey(session);

  if (session.kind === "admin" && session.role === "super_admin") {
    return {
      key,
      kind: "admin",
      id: session.id,
      role: "super_admin",
      isMember: true,
      canManage: true,
      isManager: true,
      isSuperAdmin: true,
    };
  }
  if (group.dissolvedAt !== null || !member || member.leftAt !== null) {
    return null;
  }
  const role: GroupRole = session.kind === "admin" ? "pt" : "trainee";

  return {
    key,
    kind: session.kind,
    id: session.id,
    role,
    isMember: true,
    canManage: role === "pt" && key === group.createdByKey,
    isManager: role === "pt",
    isSuperAdmin: false,
  };
};

export const canManageGroup = (actor: GroupActor) => actor.canManage;
export const isManagerActor = (actor: GroupActor) => actor.isManager;

export type SendBlockReason =
  "dissolved" | "left" | "managers_only" | "chat_off" | "restricted";

export interface SendBlockInput {
  actor: GroupActor;
  dissolved: boolean;
  managersOnly: boolean;
  // users.chatEnabled === true; ignored for admins.
  chatEnabled: boolean;
  // The block-user feature restricts the trainee; ignored for admins.
  restricted: boolean;
  // Reactions and edits stay possible under managers-only.
  ignoreManagersOnly?: boolean;
}

// The one decision for every write into a group; reading is never blocked
// here. The UI state is a hint, every write asks again on the server.
export const groupSendBlockReason = ({
  actor,
  dissolved,
  managersOnly,
  chatEnabled,
  restricted,
  ignoreManagersOnly = false,
}: SendBlockInput): SendBlockReason | null => {
  if (dissolved) {
    return "dissolved";
  }
  if (!actor.isMember) {
    return "left";
  }
  if (managersOnly && !actor.isManager && !ignoreManagersOnly) {
    return "managers_only";
  }
  if (actor.kind === "user") {
    if (!chatEnabled) {
      return "chat_off";
    }
    if (restricted) {
      return "restricted";
    }
  }
  return null;
};

export type AddMemberOutcome =
  | "added"
  | "invalid"
  | "not_found"
  | "not_trainee"
  | "out_of_scope"
  | "already_member"
  | "cap_reached";

export interface AddTarget {
  kind: "user" | "admin";
  // For an admin target: whether it is a PT account.
  isPt?: boolean;
  // For a trainee target and a PT caller: canAdminAccessUser (own trainee,
  // not hidden). Super admins skip it.
  accessible?: boolean;
}

// G1 / G3: a super admin adds any trainee and any PT; a PT adds only own,
// visible trainees and never another PT. Null = allowed.
export const addScopeOutcome = (
  actor: GroupActor,
  target: AddTarget,
): AddMemberOutcome | null => {
  if (target.kind === "admin") {
    if (!target.isPt) {
      return "not_trainee";
    }
    return actor.isSuperAdmin ? null : "out_of_scope";
  }
  if (actor.isSuperAdmin) {
    return null;
  }
  return actor.kind === "admin" && target.accessible === true
    ? null
    : "out_of_scope";
};

// Free places for explicit active members (super admin state rows excluded by
// the caller's count).
export const memberCapRoom = (activeCount: number) =>
  Math.max(0, GROUP_MEMBER_CAP - Math.max(0, activeCount));

export const canFitMembers = (activeCount: number, adding: number) =>
  adding <= memberCapRoom(activeCount);
