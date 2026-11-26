import {
  ADMIN_CLIENT_PREFIX,
  traineeClientId,
} from "@/features/chat/utils/ably-capabilities";

// Pure rules for the "đang nhập" indicator. Typing is best effort: nothing is
// stored, so a lost event only means the indicator does not show.

// A sender publishes at most one typing event per interval.
export const TYPING_THROTTLE_MS = 2500;
// The indicator disappears this long after the last typing event arrived. It
// must be longer than the throttle so continuous typing never flickers.
export const TYPING_EXPIRY_MS = 5000;

export const shouldSendTyping = (lastSentAt: number | null, now: number) =>
  lastSentAt === null ||
  now < lastSentAt || // clock moved back: do not stay silent forever
  now - lastSentAt >= TYPING_THROTTLE_MS;

export const isTypingActive = (lastReceivedAt: number | null, now: number) =>
  lastReceivedAt !== null &&
  now >= lastReceivedAt &&
  now - lastReceivedAt < TYPING_EXPIRY_MS;

export type TypingRole = "user" | "admin";

// Typing is published by the browsers on `chat:typing:<id>`; Ably stamps each
// message with the publisher's token client id, which cannot be forged. Only
// the other side shows: a trainee accepts any PT (`admin:<id>`), a PT accepts
// the trainee of this conversation. Our own echo and a second tab of the same
// person are ignored whichever role they have.
export const isTypingFromPeer = (
  senderClientId: string | null | undefined,
  ownRole: TypingRole,
  ownClientId: string | null,
  traineeUserId: number,
): boolean => {
  if (!senderClientId || senderClientId === ownClientId) {
    return false;
  }
  return ownRole === "user"
    ? senderClientId.startsWith(ADMIN_CLIENT_PREFIX)
    : senderClientId === traineeClientId(traineeUserId);
};
