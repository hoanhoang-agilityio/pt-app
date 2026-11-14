import { describe, expect, it } from "vitest";

import {
  canSendInGroup,
  groupAvatarUrl,
  type GroupMessageWire,
  groupPhotoUrl,
  parseGroupThread,
  toChatMessage,
  toThreadSnapshot,
} from "@/features/chat-groups/utils/group-thread-map";

const view = (overrides: Partial<GroupMessageWire> = {}): GroupMessageWire => ({
  id: 7,
  groupId: 3,
  kind: "message",
  senderKey: "user:5",
  senderName: "An",
  senderDeleted: false,
  senderTag: null,
  body: "chào cả nhóm",
  systemEvent: null,
  audience: null,
  clientId: "11111111-1111-4111-8111-111111111111",
  replyTo: null,
  sticker: null,
  photoId: null,
  photo: null,
  eventNames: {},
  silent: false,
  deleted: false,
  hidden: false,
  edited: false,
  reactions: [],
  seenCount: 0,
  createdAt: "2026-11-14T03:00:00.000Z",
  updatedAt: null,
  ...overrides,
});

describe("toChatMessage", () => {
  it("carries the sender key, name and tag for the shared bubbles", () => {
    const message = toChatMessage(
      view({ senderKey: "admin:2", senderName: "Coach", senderTag: "pt" }),
      "user:5",
    );

    expect(message).toMatchObject({
      id: 7,
      senderKey: "admin:2",
      senderName: "Coach",
      senderTag: "pt",
      senderRole: "admin",
      senderAdminId: 2,
      senderAdminName: "Coach",
      kind: "message",
      body: "chào cả nhóm",
      editedAt: null,
    });
  });

  it("treats a trainee sender as the user side with no admin id", () => {
    expect(toChatMessage(view(), "user:5")).toMatchObject({
      senderRole: "user",
      senderAdminId: null,
      senderAdminName: null,
    });
  });

  it("builds the photo from its size and the membership-checked route", () => {
    const message = toChatMessage(
      view({ photo: { id: 12, width: 800, height: 600 } }),
      "user:5",
    );

    expect(message.photo).toEqual({
      url: "/api/chat/groups/3/photos/12",
      width: 800,
      height: 600,
      alt: "Ảnh trong tin nhắn",
    });
    expect(groupPhotoUrl(3, 12)).toBe("/api/chat/groups/3/photos/12");
  });

  it("drops a sticker whose reference does not check out", () => {
    expect(
      toChatMessage(
        view({
          sticker: { ref: "giphy:1", url: "https://evil.example/x.gif" },
        }),
        "user:5",
      ).sticker,
    ).toBeNull();
  });

  it("keeps hidden and unsent flags and the empty body the server sent", () => {
    const hidden = toChatMessage(view({ hidden: true, body: "" }), "user:5");
    const unsent = toChatMessage(view({ deleted: true, body: "" }), "user:5");

    expect([hidden.hidden, hidden.body]).toEqual([true, ""]);
    expect([unsent.deleted, unsent.body]).toEqual([true, ""]);
  });

  it("expands the reaction counts and marks only my own with my key", () => {
    const message = toChatMessage(
      view({
        reactions: [
          { emoji: "❤️", count: 3, mine: true },
          { emoji: "👍", count: 1, mine: false },
        ],
      }),
      "user:5",
    );
    const keys = message.reactions.map((r) => `${r.emoji}:${r.reactorKey}`);

    expect(keys).toEqual([
      "❤️:user:5",
      "❤️:other:7:❤️:0",
      "❤️:other:7:❤️:1",
      "👍:other:7:👍:0",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("marks an edited message with its update time", () => {
    expect(
      toChatMessage(
        view({ edited: true, updatedAt: "2026-11-14T04:00:00.000Z" }),
        "user:5",
      ).editedAt,
    ).toBe("2026-11-14T04:00:00.000Z");
  });

  it("maps the quote with sender, sticker or photo marks and the tombstone", () => {
    const message = toChatMessage(
      view({
        replyTo: {
          id: 4,
          senderKey: "user:6",
          senderName: "Bình",
          snippet: "",
          unavailable: false,
          isSticker: false,
          isPhoto: true,
        },
      }),
      "user:5",
    );

    expect(message.replyTo).toEqual({
      id: 4,
      body: "",
      senderRole: "user",
      deleted: false,
      senderKey: "user:6",
      senderName: "Bình",
      isPhoto: true,
    });
    expect(
      toChatMessage(
        view({
          replyTo: {
            id: 4,
            senderKey: "user:6",
            senderName: "Bình",
            snippet: "",
            unavailable: true,
            isSticker: false,
            isPhoto: false,
          },
        }),
        "user:5",
      ).replyTo?.deleted,
    ).toBe(true);
  });

  it("gives a system line a stable client id, its event, the names and no reactions", () => {
    const event = {
      type: "member_left" as const,
      memberKey: "user:6",
    };
    const message = toChatMessage(
      view({
        id: 9,
        kind: "system",
        senderKey: null,
        senderName: null,
        clientId: null,
        body: "",
        systemEvent: event,
        eventNames: { "user:6": "Bình" },
        reactions: [{ emoji: "❤️", count: 1, mine: false }],
      }),
      "user:5",
    );

    expect(message).toMatchObject({
      clientId: "system-9",
      kind: "system",
      systemEvent: event,
      eventNames: { "user:6": "Bình" },
      reactions: [],
    });
  });
});

describe("canSendInGroup", () => {
  const base = {
    dissolved: false,
    managersOnly: false,
    isManager: false,
    canWriteBase: true,
  };

  it("everyone writes by default", () => {
    expect(canSendInGroup(base)).toBe(true);
  });

  it("managers-only keeps trainees out and managers in", () => {
    expect(canSendInGroup({ ...base, managersOnly: true })).toBe(false);
    expect(
      canSendInGroup({ ...base, managersOnly: true, isManager: true }),
    ).toBe(true);
  });

  it("a dissolved group and a blocked person are read-only", () => {
    expect(canSendInGroup({ ...base, dissolved: true, isManager: true })).toBe(
      false,
    );
    expect(canSendInGroup({ ...base, canWriteBase: false })).toBe(false);
  });
});

describe("thread snapshots", () => {
  const payload = {
    messages: [view()],
    hasMore: true,
    changes: [view({ id: 8, body: "sửa" })],
    lastChangeAt: 1234,
    group: {
      id: 3,
      name: "Lớp sáng",
      avatarVersion: null,
      managersOnly: true,
      dissolved: false,
    },
  };

  it("turns a payload into the snapshot the shared hook keeps", () => {
    const snapshot = toThreadSnapshot(payload, {
      viewerKey: "user:5",
      isManager: false,
      canWriteBase: true,
    });

    expect(snapshot.messages.map((m) => m.id)).toEqual([7]);
    expect(snapshot.changes?.map((m) => m.id)).toEqual([8]);
    expect(snapshot).toMatchObject({
      hasMore: true,
      lastChangeAt: 1234,
      peerReadUpTo: 0,
      chatEnabled: false,
    });
    expect(
      toThreadSnapshot(payload, {
        viewerKey: "admin:1",
        isManager: true,
        canWriteBase: true,
      }).chatEnabled,
    ).toBe(true);
  });

  it("serializes dates to ISO strings", () => {
    const snapshot = toThreadSnapshot(
      { ...payload, messages: [view({ createdAt: new Date(0) })] },
      { viewerKey: "user:5", isManager: true, canWriteBase: true },
    );

    expect(snapshot.messages[0].createdAt).toBe("1970-01-01T00:00:00.000Z");
  });

  it("rejects anything that is not a group payload", () => {
    const rights = { viewerKey: "user:5", isManager: true, canWriteBase: true };

    expect(parseGroupThread(null, rights)).toBeNull();
    expect(parseGroupThread({ messages: [] }, rights)).toBeNull();
    expect(parseGroupThread({ error: "not_found" }, rights)).toBeNull();
    expect(parseGroupThread(payload, rights)?.messages).toHaveLength(1);
  });
});

describe("avatar url", () => {
  it("is versioned for caching and absent without a photo", () => {
    expect(groupAvatarUrl(3, 1700000000)).toBe(
      "/api/chat/groups/3/avatar?v=1700000000",
    );
    expect(groupAvatarUrl(3, null)).toBeNull();
  });
});
