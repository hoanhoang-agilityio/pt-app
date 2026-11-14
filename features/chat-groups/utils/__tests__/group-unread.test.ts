import { describe, expect, it } from "vitest";

import {
  countUnreadFor,
  isUnreadFor,
  seenByKeys,
  type UnreadCandidate,
} from "@/features/chat-groups/utils/group-unread";

const at = (iso: string) => new Date(iso);
const message = (over: Partial<UnreadCandidate> = {}): UnreadCandidate => ({
  id: 10,
  kind: "message",
  senderKey: "user:2",
  audience: null,
  deletedAt: null,
  hiddenAt: null,
  createdAt: at("2026-11-10T00:00:00Z"),
  ...over,
});
const viewer = { key: "user:1", lastReadMessageId: 5 };

describe("isUnreadFor", () => {
  it("counts a new message from someone else", () => {
    expect(isUnreadFor(message(), viewer)).toBe(true);
  });

  it.each([
    ["own", { senderKey: "user:1" }],
    ["system line", { kind: "system" as const, senderKey: null }],
    ["alert", { kind: "system" as const, audience: "super_admin" as const }],
    ["unsent", { deletedAt: at("2026-11-11T00:00:00Z") }],
    ["hidden", { hiddenAt: at("2026-11-11T00:00:00Z") }],
    ["already read", { id: 5 }],
  ])("excludes %s", (_name, over) => {
    expect(isUnreadFor(message(over), viewer)).toBe(false);
  });

  it("ignores messages older than a super admin's account", () => {
    const admin = { ...viewer, baselineAt: at("2026-11-12T00:00:00Z") };

    expect(isUnreadFor(message(), admin)).toBe(false);
    expect(
      isUnreadFor(message({ createdAt: at("2026-11-12T00:00:00Z") }), admin),
    ).toBe(true);
  });

  it("counts a list", () => {
    expect(
      countUnreadFor(
        [
          message({ id: 6 }),
          message({ id: 7, senderKey: "user:1" }),
          message({ id: 8 }),
        ],
        viewer,
      ),
    ).toBe(2);
  });
});

describe("seenByKeys", () => {
  const cursors = [
    { memberKey: "user:2", lastReadMessageId: 12 },
    { memberKey: "user:3", lastReadMessageId: 9 },
    { memberKey: "admin:1", lastReadMessageId: 10 },
  ];

  it("lists members at or past the message and never the sender", () => {
    expect(seenByKeys({ id: 10, senderKey: "user:2" }, cursors)).toEqual([
      "admin:1",
    ]);
    expect(seenByKeys({ id: 13, senderKey: "user:2" }, cursors)).toEqual([]);
  });
});
