import { describe, expect, it } from "vitest";

import { qk } from "../query-keys";
import {
  invalidationsFor,
  isPeerTypingEvent,
  shouldSendTyping,
  threadActionFor,
} from "../realtime-events";

describe("threadActionFor", () => {
  it("syncs the coach chat on its own events only", () => {
    const target = { kind: "coach", conversationId: 4 } as const;

    expect(threadActionFor(target, "message", { conversationId: 4 })).toBe("sync");
    expect(threadActionFor(target, "message", { conversationId: 5 })).toBeNull();
    expect(threadActionFor(target, "read", { conversationId: 4 })).toBe("sync");
    expect(threadActionFor(target, "typing", { conversationId: 4 })).toBe("typing");
    expect(threadActionFor(target, "inbox", { conversationId: 4 })).toBeNull();
  });

  it("syncs a coach chat that has no conversation yet on any message", () => {
    expect(
      threadActionFor({ kind: "coach", conversationId: null }, "message", { conversationId: 9 }),
    ).toBe("sync");
  });

  it("matches group events by groupId", () => {
    const target = { kind: "group", groupId: 2 } as const;

    expect(threadActionFor(target, "group:message", { groupId: 2 })).toBe("sync");
    expect(threadActionFor(target, "group:read", { groupId: 3 })).toBeNull();
    expect(threadActionFor(target, "message", { conversationId: 2 })).toBeNull();
  });

  it("matches DM events by conversation", () => {
    const target = { kind: "dm", conversationId: 8 } as const;

    expect(threadActionFor(target, "dm:update", { conversationId: 8 })).toBe("sync");
    expect(threadActionFor(target, "dm:read", { conversationId: 1 })).toBeNull();
  });

  it("ignores payloads that are not objects", () => {
    expect(threadActionFor({ kind: "group", groupId: 2 }, "group:message", null)).toBeNull();
    expect(threadActionFor({ kind: "dm", conversationId: 2 }, "dm:update", "x")).toBeNull();
  });
});

describe("invalidationsFor", () => {
  it("maps events to the lists and badges they change", () => {
    expect(invalidationsFor("message")).toEqual([qk.inbox, qk.unread, qk.bubbles]);
    expect(invalidationsFor("group:message")).toEqual([qk.groups, qk.groupUnread]);
    expect(invalidationsFor("dm:update")).toEqual([qk.dmInbox, qk.unread]);
    expect(invalidationsFor("typing")).toEqual([]);
  });
});

describe("typing", () => {
  it("throttles to one event per 2.5 s and recovers from a clock change", () => {
    expect(shouldSendTyping(null, 1000)).toBe(true);
    expect(shouldSendTyping(1000, 3499)).toBe(false);
    expect(shouldSendTyping(1000, 3500)).toBe(true);
    expect(shouldSendTyping(5000, 1000)).toBe(true);
  });

  it("shows only the other side's typing", () => {
    expect(isPeerTypingEvent({ role: "admin", senderKey: "admin:1" }, "user", "user:2")).toBe(true);
    expect(isPeerTypingEvent({ role: "user", senderKey: "user:2" }, "user", "user:2")).toBe(false);
    expect(isPeerTypingEvent({ role: "bad", senderKey: "x" }, "user", "user:2")).toBe(false);
    expect(isPeerTypingEvent(null, "user", "user:2")).toBe(false);
  });
});
