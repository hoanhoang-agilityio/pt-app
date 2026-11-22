import { REALTIME_EVENTS } from "@pt/contracts";

import { qk } from "./query-keys";

// Maps the Socket.IO events (ids only, never message text) to what the app
// does about them, the same way apps/web does: any event just triggers a
// fetch, the database stays the source of truth.

export type ThreadTarget =
  | { kind: "coach"; conversationId: number | null }
  | { kind: "group"; groupId: number }
  | { kind: "dm"; conversationId: number };

export type ThreadAction = "sync" | "typing" | null;

const COACH_SYNC = new Set<string>([
  REALTIME_EVENTS.message,
  REALTIME_EVENTS.messageUpdate,
  REALTIME_EVENTS.read,
  REALTIME_EVENTS.profileUpdate,
  REALTIME_EVENTS.chatStatus,
]);

const GROUP_SYNC = new Set<string>([
  REALTIME_EVENTS.groupMessage,
  REALTIME_EVENTS.groupMessageUpdate,
  REALTIME_EVENTS.groupRead,
  REALTIME_EVENTS.groupMembers,
]);

const DM_SYNC = new Set<string>([REALTIME_EVENTS.dmUpdate, REALTIME_EVENTS.dmRead]);

const numberField = (data: unknown, field: string) => {
  const value =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)[field]
      : undefined;

  return typeof value === "number" ? value : null;
};

export const conversationIdOf = (data: unknown) =>
  numberField(data, "conversationId");
export const groupIdOf = (data: unknown) => numberField(data, "groupId");

// What an open thread does with an event.
export const threadActionFor = (
  target: ThreadTarget,
  name: string,
  data: unknown,
): ThreadAction => {
  if (target.kind === "group") {
    return GROUP_SYNC.has(name) && groupIdOf(data) === target.groupId
      ? "sync"
      : null;
  }
  const conversationId = conversationIdOf(data);

  if (target.kind === "dm") {
    return DM_SYNC.has(name) && conversationId === target.conversationId
      ? "sync"
      : null;
  }
  // Coach chat: an event that names another conversation is not ours.
  if (
    conversationId !== null &&
    target.conversationId !== null &&
    conversationId !== target.conversationId
  ) {
    return null;
  }
  if (name === REALTIME_EVENTS.typing) {
    return "typing";
  }
  return COACH_SYNC.has(name) ? "sync" : null;
};

// Query keys to invalidate (inbox lists and badges) for an event.
export const invalidationsFor = (name: string) => {
  switch (name) {
    case REALTIME_EVENTS.message:
    case REALTIME_EVENTS.messageUpdate:
    case REALTIME_EVENTS.read:
    case REALTIME_EVENTS.inbox:
    case REALTIME_EVENTS.chatStatus:
      return [qk.inbox, qk.unread, qk.bubbles];
    case REALTIME_EVENTS.dmUpdate:
    case REALTIME_EVENTS.dmRead:
      return [qk.dmInbox, qk.unread];
    case REALTIME_EVENTS.groupMessage:
    case REALTIME_EVENTS.groupMessageUpdate:
    case REALTIME_EVENTS.groupRead:
    case REALTIME_EVENTS.groupMembers:
      return [qk.groups, qk.groupUnread];
    case REALTIME_EVENTS.presence:
      return [qk.bubbles, ["chat", "presence"]];
    default:
      return [];
  }
};

export const isAuthRevoked = (name: string) =>
  name === REALTIME_EVENTS.authRevoked;

// The indicator disappears this long after the last typing event.
export { TYPING_EXPIRY_MS, TYPING_THROTTLE_MS } from "@pt/contracts";

export const shouldSendTyping = (lastSentAt: number | null, now: number) =>
  lastSentAt === null ||
  now < lastSentAt ||
  now - lastSentAt >= 2500;

// Only the other side's typing shows.
export const isPeerTypingEvent = (
  data: unknown,
  myRole: "user" | "admin",
  myKey: string,
) => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const { role, senderKey } = data as Record<string, unknown>;

  return (
    (role === "user" || role === "admin") &&
    typeof senderKey === "string" &&
    senderKey !== myKey &&
    // Trainee chat: the other side is the other role. Admin chat too.
    role !== myRole
  );
};
