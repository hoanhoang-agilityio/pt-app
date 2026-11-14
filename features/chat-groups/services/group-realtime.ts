import "server-only";

import {
  createChatTokenRequest,
  publishChatEvent,
} from "@/features/chat/services/chat-realtime";
import {
  adminClientId,
  GROUP_EVENTS,
  groupCapability,
  groupChannel,
  groupMembersEvent,
  groupMessageEvent,
  groupMessageUpdateEvent,
  groupReadEvent,
  traineeClientId,
} from "@/features/chat/utils/ably-capabilities";
import type { GroupActor } from "@/features/chat-groups/types/group";
import { logServerError } from "@/services/logger";

// Events carry ids only; every function never throws and is a no-op without
// Ably (clients poll). Called after the database write.

export const publishGroupMessage = async (
  groupId: number,
  messageId: number,
) => {
  try {
    await publishChatEvent(
      groupChannel(groupId),
      GROUP_EVENTS.MESSAGE,
      groupMessageEvent(groupId, messageId),
    );
  } catch (error) {
    logServerError("publishGroupMessage", error, { groupId });
  }
};

// Edit, unsend, reaction or hide.
export const publishGroupUpdate = async (
  groupId: number,
  messageId: number,
) => {
  try {
    await publishChatEvent(
      groupChannel(groupId),
      GROUP_EVENTS.MESSAGE_UPDATE,
      groupMessageUpdateEvent(groupId, messageId),
    );
  } catch (error) {
    logServerError("publishGroupUpdate", error, { groupId });
  }
};

export const publishGroupRead = async (
  groupId: number,
  readerKey: string,
  lastReadMessageId: number,
) => {
  try {
    await publishChatEvent(
      groupChannel(groupId),
      GROUP_EVENTS.READ,
      groupReadEvent(groupId, readerKey, lastReadMessageId),
    );
  } catch (error) {
    logServerError("publishGroupRead", error, { groupId });
  }
};

// Members, name, photo or managers-only changed.
export const publishGroupMembers = async (groupId: number) => {
  try {
    await publishChatEvent(
      groupChannel(groupId),
      GROUP_EVENTS.MEMBERS,
      groupMembersEvent(groupId),
    );
  } catch (error) {
    logServerError("publishGroupMembers", error, { groupId });
  }
};

// One signed token request for one group, after the membership check (the
// caller passes the actor loadGroupActor built). Subscribe only, never a
// wildcard. Null = Ably is not configured.
export const createGroupTokenRequest = async (
  groupId: number,
  actor: Pick<GroupActor, "kind" | "id">,
) =>
  createChatTokenRequest({
    clientId:
      actor.kind === "admin"
        ? adminClientId(actor.id)
        : traineeClientId(actor.id),
    capability: groupCapability(groupId),
  });
