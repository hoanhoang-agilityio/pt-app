import { describe, expect, it } from "vitest";

import {
  ABLY_TOKEN_TTL_MS,
  adminCapability,
  adminClientId,
  CHAT_EVENTS,
  chatStatusEvent,
  conversationChannel,
  dmConversationChannel,
  dmEvent,
  GROUP_EVENTS,
  groupCapability,
  groupChannel,
  groupMembersEvent,
  groupMessageEvent,
  groupMessageUpdateEvent,
  groupReadEvent,
  INBOX_CHANNEL,
  inboxEvent,
  messageEvent,
  messageUpdateEvent,
  readEvent,
  traineeCapability,
  traineeClientId,
  typingChannel,
  userChannel,
} from "@/features/chat/utils/ably-capabilities";

describe("channel names", () => {
  it("builds names under the chat: prefix", () => {
    expect(conversationChannel(5)).toBe("chat:conversation:5");
    expect(userChannel(3)).toBe("chat:user:3");
    expect(INBOX_CHANNEL).toBe("chat:inbox");
    expect(typingChannel(5)).toBe("chat:typing:5");
    expect(() => typingChannel(0)).toThrow();
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects invalid id %s", (id) => {
    expect(() => conversationChannel(id)).toThrow();
    expect(() => userChannel(id)).toThrow();
    expect(() => traineeClientId(id)).toThrow();
    expect(() => adminClientId(id)).toThrow();
  });
});

describe("capabilities", () => {
  it("gives a trainee subscribe on own channels, publish only on own typing", () => {
    expect(traineeCapability(3, 5)).toEqual({
      "chat:conversation:5": ["subscribe"],
      "chat:typing:5": ["publish", "subscribe"],
      "chat:user:3": ["subscribe"],
    });
  });

  it("gives an admin subscribe on all conversations and the inbox, typing on any", () => {
    expect(adminCapability()).toEqual({
      "chat:conversation:*": ["subscribe"],
      "chat:typing:*": ["publish", "subscribe"],
      "chat:inbox": ["subscribe"],
    });
  });

  it("limits a PT to the listed conversations (and their typing) plus the inbox", () => {
    expect(adminCapability([4, 9])).toEqual({
      "chat:conversation:4": ["subscribe"],
      "chat:typing:4": ["publish", "subscribe"],
      "chat:conversation:9": ["subscribe"],
      "chat:typing:9": ["publish", "subscribe"],
      "chat:inbox": ["subscribe"],
    });
  });

  it("grants publish only on typing channels, never presence or history", () => {
    for (const capability of [
      traineeCapability(3, 5, [7]),
      adminCapability(),
      adminCapability([4]),
    ]) {
      const json = JSON.stringify(capability);

      Object.entries(capability).forEach(([name, operations]) => {
        if (operations.includes("publish")) {
          expect(name.startsWith("chat:typing:")).toBe(true);
        }
      });
      expect(json).not.toContain("presence");
      expect(json).not.toContain("history");
      Object.keys(capability).forEach((name) =>
        expect(name.startsWith("chat:")).toBe(true),
      );
    }
  });

  it("builds client ids and a 15 minute ttl", () => {
    expect(traineeClientId(3)).toBe("user:3");
    expect(adminClientId(7)).toBe("admin:7");
    expect(ABLY_TOKEN_TTL_MS).toBe(900000);
  });
});

describe("event payloads", () => {
  it("exposes event names", () => {
    expect(CHAT_EVENTS).toEqual({
      MESSAGE: "message",
      MESSAGE_UPDATE: "message-update",
      PROFILE_UPDATE: "profile-update",
      READ: "read",
      CHAT_STATUS: "chat-status",
      INBOX: "inbox",
      TYPING: "typing",
    });
  });

  it("publishes message updates with ids only", () => {
    expect(messageUpdateEvent(5, 9)).toEqual({
      conversationId: 5,
      messageId: 9,
    });
    expect(() => messageUpdateEvent(0, 9)).toThrow();
  });

  it("passes only public message fields", () => {
    const createdAt = new Date("2026-11-04T10:00:00.000Z");
    const event = messageEvent({
      id: 9,
      conversationId: 5,
      senderRole: "admin",
      senderAdminId: 7,
      body: "hi",
      clientId: "c1",
      createdAt,
      // @ts-expect-error extra fields must not leak
      senderAdminName: "pt",
    });

    expect(event).toEqual({
      id: 9,
      conversationId: 5,
      senderRole: "admin",
      senderAdminId: 7,
      body: "hi",
      clientId: "c1",
      createdAt: "2026-11-04T10:00:00.000Z",
    });
  });

  it("builds read, status and inbox payloads without a body", () => {
    expect(readEvent("user", 4)).toEqual({
      readerKey: "user",
      lastReadMessageId: 4,
    });
    expect(chatStatusEvent(false)).toEqual({ enabled: false });
    expect(inboxEvent(5, 9, "user")).toEqual({
      conversationId: 5,
      messageId: 9,
      senderRole: "user",
    });
    expect(() => inboxEvent(0, 9, "user")).toThrow();
  });
});

describe("trainee chat (dm) channels", () => {
  it("lives under chat:dm:conversation:<id>", () => {
    expect(dmConversationChannel(7)).toBe("chat:dm:conversation:7");
    expect(() => dmConversationChannel(0)).toThrow();
  });

  it("subscribes a trainee to their own dm conversations only, no wildcard", () => {
    const capability = traineeCapability(3, 5, [7, 9]);

    expect(capability).toEqual({
      "chat:conversation:5": ["subscribe"],
      "chat:typing:5": ["publish", "subscribe"],
      "chat:user:3": ["subscribe"],
      "chat:dm:conversation:7": ["subscribe"],
      "chat:dm:conversation:9": ["subscribe"],
    });
    for (const [channel, operations] of Object.entries(capability)) {
      expect(channel).not.toContain("*");
      expect(operations).toEqual(
        channel === "chat:typing:5" ? ["publish", "subscribe"] : ["subscribe"],
      );
    }
  });

  it("adds nothing without dm conversations", () => {
    expect(Object.keys(traineeCapability(3, 5))).toHaveLength(3);
  });

  it("an event carries ids only", () => {
    expect(dmEvent(1, 2, 3)).toEqual({
      conversationId: 1,
      messageId: 2,
      senderId: 3,
    });
  });
});

describe("group chat channels", () => {
  it("names the channel under chat: and one id", () => {
    expect(groupChannel(12)).toBe("chat:group:12");
    expect(groupChannel(12).startsWith("chat:")).toBe(true);
  });

  it("grants subscribe on exactly one channel, never a wildcard", () => {
    const capability = groupCapability(12);

    expect(capability).toEqual({ "chat:group:12": ["subscribe"] });
    expect(Object.keys(capability).some((name) => name.includes("*"))).toBe(
      false,
    );
  });

  it.each([0, -3, 2.5, Number.NaN])("rejects the group id %s", (id) => {
    expect(() => groupChannel(id)).toThrow("Invalid groupId");
    expect(() => groupCapability(id)).toThrow("Invalid groupId");
    expect(() => groupMessageEvent(id, 1)).toThrow("Invalid groupId");
  });

  it("builds ids-only events", () => {
    expect(Object.values(GROUP_EVENTS).sort()).toEqual([
      "members",
      "message",
      "message-update",
      "read",
    ]);
    expect(groupMessageEvent(2, 9)).toEqual({ groupId: 2, messageId: 9 });
    expect(groupMessageUpdateEvent(2, 9)).toEqual({ groupId: 2, messageId: 9 });
    expect(groupReadEvent(2, "admin:1", 5)).toEqual({
      groupId: 2,
      readerKey: "admin:1",
      lastReadMessageId: 5,
    });
    expect(groupMembersEvent(2)).toEqual({ groupId: 2 });
  });
});
