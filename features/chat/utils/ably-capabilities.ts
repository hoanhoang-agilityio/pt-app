// Pure helpers for Ably channel names, token capabilities and event payloads.
// The API key is restricted to `chat:*`, so every name must start with it.

export const CHAT_CHANNEL_PREFIX = "chat";
export const INBOX_CHANNEL = `${CHAT_CHANNEL_PREFIX}:inbox`;
export const ABLY_TOKEN_TTL_MS = 15 * 60 * 1000;

export const CHAT_EVENTS = {
  MESSAGE: "message",
  MESSAGE_UPDATE: "message-update",
  PROFILE_UPDATE: "profile-update",
  READ: "read",
  CHAT_STATUS: "chat-status",
  INBOX: "inbox",
  TYPING: "typing",
} as const;

const assertId = (value: number, label: string) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return value;
};

export const conversationChannel = (conversationId: number) =>
  `${CHAT_CHANNEL_PREFIX}:conversation:${assertId(conversationId, "conversationId")}`;

// Trainee-to-trainee chats (P5). The Ably key only covers `chat:*`, so the
// channel lives under that prefix: `chat:dm:conversation:<id>`.
export const dmConversationChannel = (conversationId: number) =>
  `${CHAT_CHANNEL_PREFIX}:dm:conversation:${assertId(conversationId, "conversationId")}`;

// Group chats: `chat:group:<id>`. Tokens are minted per open group after the
// membership check and carry exactly this one channel, never a wildcard (not
// even for super admins).
export const groupChannel = (groupId: number) =>
  `${CHAT_CHANNEL_PREFIX}:group:${assertId(groupId, "groupId")}`;

export const userChannel = (userId: number) =>
  `${CHAT_CHANNEL_PREFIX}:user:${assertId(userId, "userId")}`;

export type AblyCapability = Record<string, string[]>;

// Subscribe only: nobody publishes from the browser (messages and typing go
// through the server, see POST /api/chat/typing), and there is no presence or
// history. A publish right on a channel would also allow forged "message"
// events, because Ably capabilities are per channel, not per event name.
export const traineeCapability = (
  userId: number,
  conversationId: number,
  dmConversationIds: number[] = [],
): AblyCapability => ({
  [conversationChannel(conversationId)]: ["subscribe"],
  [userChannel(userId)]: ["subscribe"],
  // Only the trainee's own chats, one entry each, never a wildcard.
  ...Object.fromEntries(
    dmConversationIds.map((id) => [dmConversationChannel(id), ["subscribe"]]),
  ),
});

// A super admin follows every conversation; a PT (conversationIds given) only
// those of their workspace. The inbox channel carries ids and the sender role
// only, never text.
export const adminCapability = (
  conversationIds?: number[],
): AblyCapability => ({
  ...(conversationIds
    ? Object.fromEntries(
        conversationIds.map((id) => [conversationChannel(id), ["subscribe"]]),
      )
    : { [`${CHAT_CHANNEL_PREFIX}:conversation:*`]: ["subscribe"] }),
  [INBOX_CHANNEL]: ["subscribe"],
});

// Trainee chat events carry ids only, never text; clients fetch what is new.
export const DM_EVENTS = { MESSAGE: "message", UPDATE: "update" } as const;

export const dmEvent = (
  conversationId: number,
  messageId: number,
  senderId: number,
) => ({
  conversationId: assertId(conversationId, "conversationId"),
  messageId: assertId(messageId, "messageId"),
  senderId: assertId(senderId, "senderId"),
});

export const traineeClientId = (userId: number) =>
  `user:${assertId(userId, "userId")}`;

export const adminClientId = (adminId: number) =>
  `admin:${assertId(adminId, "adminId")}`;

export interface ChatMessageEventSource {
  id: number;
  conversationId: number;
  senderRole: "user" | "admin";
  senderAdminId: number | null;
  body: string;
  clientId: string;
  createdAt: Date;
}

// Only public message fields; createdAt as ISO string (JSON-safe).
export const messageEvent = (message: ChatMessageEventSource) => ({
  id: assertId(message.id, "messageId"),
  conversationId: assertId(message.conversationId, "conversationId"),
  senderRole: message.senderRole,
  senderAdminId: message.senderAdminId,
  body: message.body,
  clientId: message.clientId,
  createdAt: message.createdAt.toISOString(),
});

// Ids only: an edit, unsend or reaction never puts text on the wire. Clients
// react by fetching /messages?changedSince=...
export const messageUpdateEvent = (
  conversationId: number,
  messageId: number,
) => ({
  conversationId: assertId(conversationId, "conversationId"),
  messageId: assertId(messageId, "messageId"),
});

// A nickname or colour changed: ids only, clients refetch the thread.
export const profileUpdateEvent = (conversationId: number) => ({
  conversationId: assertId(conversationId, "conversationId"),
});

export const readEvent = (readerKey: string, lastReadMessageId: number) => ({
  readerKey,
  lastReadMessageId,
});

export const chatStatusEvent = (enabled: boolean) => ({ enabled });

// The inbox never carries the message body.
export const inboxEvent = (
  conversationId: number,
  messageId: number,
  senderRole: "user" | "admin",
) => ({
  conversationId: assertId(conversationId, "conversationId"),
  messageId: assertId(messageId, "messageId"),
  senderRole,
});

// Who is typing: the role plus the sender's Ably client id, so a second tab of
// the same person can ignore its own echo. Never carries text.
export const typingEvent = (role: "user" | "admin", senderKey: string) => ({
  role,
  senderKey,
});

export const GROUP_EVENTS = {
  MESSAGE: "message",
  MESSAGE_UPDATE: "message-update",
  READ: "read",
  MEMBERS: "members",
} as const;

// Subscribe only, one channel: see groupChannel.
export const groupCapability = (groupId: number): AblyCapability => ({
  [groupChannel(groupId)]: ["subscribe"],
});

// Group events carry ids only, never text; clients refetch.
export const groupMessageEvent = (groupId: number, messageId: number) => ({
  groupId: assertId(groupId, "groupId"),
  messageId: assertId(messageId, "messageId"),
});

export const groupMessageUpdateEvent = (groupId: number, messageId: number) =>
  groupMessageEvent(groupId, messageId);

export const groupReadEvent = (
  groupId: number,
  readerKey: string,
  lastReadMessageId: number,
) => ({
  groupId: assertId(groupId, "groupId"),
  readerKey,
  lastReadMessageId,
});

export const groupMembersEvent = (groupId: number) => ({
  groupId: assertId(groupId, "groupId"),
});
