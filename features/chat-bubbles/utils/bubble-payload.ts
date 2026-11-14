import {
  parseAdminUnread,
  parseUserUnread,
} from "@/features/chat/utils/unread-payload";
import type { IncomingEntry } from "@/features/chat-bubbles/utils/incoming-rules";
import type { BubbleRole } from "@/features/chat-bubbles/types";

// What the bubble host reads from the unread poll. Group chats (the `groups`
// field of the same payload) are phase 2: they never get a bubble, a badge or
// a pop, so only the coach chat and the per-trainee chats are read here.

export const bubbleUnreadFrom = (
  role: BubbleRole,
  payload: unknown,
): Record<string, number> => {
  if (role === "user") {
    return { coach: parseUserUnread(payload).coachCount };
  }
  return Object.fromEntries(
    parseAdminUnread(payload).perTrainee.map((row) => [
      `user:${row.userId}`,
      row.unread,
    ]),
  );
};

export const bubbleEntriesFrom = (
  role: BubbleRole,
  payload: unknown,
): IncomingEntry[] =>
  role === "user"
    ? [
        {
          key: "coach",
          latestLoudIncomingId: parseUserUnread(payload).latestLoudIncomingId,
        },
      ]
    : parseAdminUnread(payload).perTrainee.map((row) => ({
        key: `user:${row.userId}`,
        latestLoudIncomingId: row.latestLoudIncomingId,
      }));
