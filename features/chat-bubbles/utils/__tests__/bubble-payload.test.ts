import { describe, expect, it } from "vitest";

import {
  chatPathForKey,
  isKeyForRole,
} from "@/features/chat-bubbles/utils/bubble-links";
import {
  bubbleEntriesFrom,
  bubbleUnreadFrom,
} from "@/features/chat-bubbles/utils/bubble-payload";

const groups = {
  total: 9,
  perGroup: [
    { groupId: 3, unread: 4 },
    { groupId: 7, unread: 5 },
  ],
};

const adminPayload = {
  count: 2,
  perTrainee: [
    { userId: 5, conversationId: 1, unread: 2, latestLoudIncomingId: 40 },
  ],
  groups,
};

const userPayload = {
  count: 3,
  coachCount: 3,
  latestLoudIncomingId: 12,
  groups,
};

describe("bubble payload ignores group chats", () => {
  it("an admin gets one entry and one badge per trainee, none per group", () => {
    expect(bubbleUnreadFrom("admin", adminPayload)).toEqual({ "user:5": 2 });
    expect(bubbleEntriesFrom("admin", adminPayload)).toEqual([
      { key: "user:5", latestLoudIncomingId: 40 },
    ]);
  });

  it("a trainee gets only the coach chat, whatever the groups say", () => {
    expect(bubbleUnreadFrom("user", userPayload)).toEqual({ coach: 3 });
    expect(bubbleEntriesFrom("user", userPayload)).toEqual([
      { key: "coach", latestLoudIncomingId: 12 },
    ]);
  });

  it("a payload with only groups produces nothing for an admin", () => {
    expect(bubbleUnreadFrom("admin", { groups })).toEqual({});
    expect(bubbleEntriesFrom("admin", { groups })).toEqual([]);
  });

  it("never accepts a group key as a bubble, for either role", () => {
    for (const key of ["group:3", "groups:3", "group", "admin:3"]) {
      expect(isKeyForRole("admin", key)).toBe(false);
      expect(isKeyForRole("user", key)).toBe(false);
      expect(chatPathForKey("admin", key)).toBeNull();
    }
  });
});
