"use server";

import { GROUP_MESSAGES } from "@/features/chat-groups/constants/messages";
import {
  sessionOfAdmin,
  sessionOfUser,
} from "@/features/chat-groups/services/group-access";
import { loadGroupActor } from "@/features/chat-groups/services/group-access";
import {
  type ActionContext,
  addGroupMembers,
  createGroup,
  leaveGroupAsMember,
  markGroupRead,
  removeGroupMember,
  renameGroup,
  sendGroupMessage,
  setGroupAvatar,
  setGroupMuted,
  setManagersOnly,
} from "@/features/chat-groups/services/group-core";
import {
  editGroupMessage,
  hideGroupMessage,
  reactToGroupMessage,
  unsendGroupMessage,
} from "@/features/chat-groups/services/group-mutations";
import { withResultErrorHandling } from "@/services/action-errors";
import { requireAdmin, requireUser } from "@/services/auth-guard";

// Server actions of group chat, one export per role. Every admin action calls
// requireAdmin() first and every trainee action requireUser(); the session
// decides who acts, the group id is the only thing taken from the client and
// every action re-checks membership through loadGroupActor. Inputs go
// through Zod in the core.

const asAdmin = async (): Promise<ActionContext> => {
  const admin = await requireAdmin();

  return { session: sessionOfAdmin(admin), user: null };
};

const asUser = async (): Promise<ActionContext> => {
  const user = await requireUser();

  return {
    session: sessionOfUser(user),
    user: { id: user.id, chatEnabled: user.chatEnabled },
  };
};

const notFound = {
  status: "error" as const,
  message: GROUP_MESSAGES.GROUP_NOT_FOUND,
};

// Message mutations take the loaded context and the trainee (for chat off and
// restrictions); an unknown or foreign group answers "not found".
const mutate =
  <T>(
    run: (
      context: NonNullable<Awaited<ReturnType<typeof loadGroupActor>>>,
      user: ActionContext["user"],
      input: unknown,
    ) => Promise<T>,
  ) =>
  async (ctx: ActionContext, input: unknown) => {
    const groupId = (input as { groupId?: unknown } | null)?.groupId;
    const context = await loadGroupActor(groupId, ctx.session);

    return context ? run(context, ctx.user, input) : notFound;
  };

const react = mutate(reactToGroupMessage);
const edit = mutate(editGroupMessage);
const unsend = mutate(unsendGroupMessage);
const hide = mutate(hideGroupMessage);

// ---- admins (super admin and PT) -----------------------------------------

export const createGroupAction = withResultErrorHandling(
  "createGroup",
  async (input: unknown) => createGroup(await asAdmin(), input),
);

export const addGroupMembersAction = withResultErrorHandling(
  "addGroupMembers",
  async (input: unknown) => addGroupMembers(await asAdmin(), input),
);

export const removeGroupMemberAction = withResultErrorHandling(
  "removeGroupMember",
  async (input: unknown) => removeGroupMember(await asAdmin(), input),
);

export const renameGroupAction = withResultErrorHandling(
  "renameGroup",
  async (input: unknown) => renameGroup(await asAdmin(), input),
);

export const setGroupAvatarAction = withResultErrorHandling(
  "setGroupAvatar",
  async (input: unknown) => setGroupAvatar(await asAdmin(), input),
);

export const setGroupManagersOnlyAction = withResultErrorHandling(
  "setGroupManagersOnly",
  async (input: unknown) => setManagersOnly(await asAdmin(), input),
);

export const hideGroupMessageAction = withResultErrorHandling(
  "hideGroupMessage",
  async (input: unknown) => hide(await asAdmin(), input),
);

export const adminLeaveGroupAction = withResultErrorHandling(
  "adminLeaveGroup",
  async (input: unknown) => leaveGroupAsMember(await asAdmin(), input),
);

export const adminSetGroupMutedAction = withResultErrorHandling(
  "adminSetGroupMuted",
  async (input: unknown) => setGroupMuted(await asAdmin(), input),
);

export const adminMarkGroupReadAction = withResultErrorHandling(
  "adminMarkGroupRead",
  async (input: unknown) => markGroupRead(await asAdmin(), input),
);

export const adminSendGroupMessageAction = withResultErrorHandling(
  "adminSendGroupMessage",
  async (input: unknown) => sendGroupMessage(await asAdmin(), input),
);

export const adminReactGroupMessageAction = withResultErrorHandling(
  "adminReactGroupMessage",
  async (input: unknown) => react(await asAdmin(), input),
);

export const adminEditGroupMessageAction = withResultErrorHandling(
  "adminEditGroupMessage",
  async (input: unknown) => edit(await asAdmin(), input),
);

export const adminUnsendGroupMessageAction = withResultErrorHandling(
  "adminUnsendGroupMessage",
  async (input: unknown) => unsend(await asAdmin(), input),
);

// ---- trainees ---------------------------------------------------------------

export const leaveGroupAction = withResultErrorHandling(
  "leaveGroup",
  async (input: unknown) => leaveGroupAsMember(await asUser(), input),
);

export const setGroupMutedAction = withResultErrorHandling(
  "setGroupMuted",
  async (input: unknown) => setGroupMuted(await asUser(), input),
);

export const markGroupReadAction = withResultErrorHandling(
  "markGroupRead",
  async (input: unknown) => markGroupRead(await asUser(), input),
);

export const sendGroupMessageAction = withResultErrorHandling(
  "sendGroupMessage",
  async (input: unknown) => sendGroupMessage(await asUser(), input),
);

export const reactGroupMessageAction = withResultErrorHandling(
  "reactGroupMessage",
  async (input: unknown) => react(await asUser(), input),
);

export const editGroupMessageAction = withResultErrorHandling(
  "editGroupMessage",
  async (input: unknown) => edit(await asUser(), input),
);

export const unsendGroupMessageAction = withResultErrorHandling(
  "unsendGroupMessage",
  async (input: unknown) => unsend(await asUser(), input),
);
