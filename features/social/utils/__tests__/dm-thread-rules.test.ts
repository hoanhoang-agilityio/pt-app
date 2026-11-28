import { describe, expect, it } from "vitest";

import type { DmMessageView } from "@/features/social/types/dm";
import {
  type DmThreadItem,
  lastSeenOwnId,
  lastServerId,
  mergeThread,
  prependOlder,
} from "@/features/social/utils/dm-thread-rules";

const msg = (id: number, senderId = 1, clientId = `c${id}`): DmMessageView => ({
  id,
  senderId,
  body: `m${id}`,
  photo: null,
  post: null,
  clientId,
  createdAt: "2026-11-08T00:00:00.000Z",
});

describe("mergeThread", () => {
  it("appends new messages once and keeps them ordered", () => {
    const merged = mergeThread([msg(1)], [msg(3), msg(2), msg(1)], []);

    expect(merged.map((m) => m.id)).toEqual([1, 2, 3]);
  });

  it("drops unsent messages", () => {
    expect(
      mergeThread([msg(1), msg(2)], [msg(3)], [2]).map((m) => m.id),
    ).toEqual([1, 3]);
  });

  it("turns quotes of an unsent message into tombstones", () => {
    const quoting: DmMessageView = {
      ...msg(3),
      replyTo: {
        id: 2,
        senderId: 1,
        body: "m2",
        photoCount: 2,
        deleted: false,
      },
    };
    const other: DmMessageView = {
      ...msg(4),
      replyTo: {
        id: 1,
        senderId: 1,
        body: "m1",
        photoCount: 0,
        deleted: false,
      },
    };
    const merged = mergeThread([msg(1), msg(2), quoting], [other], [2]);

    expect(merged.map((m) => m.id)).toEqual([1, 3, 4]);
    expect(merged[1].replyTo).toEqual({
      id: 2,
      senderId: 1,
      body: null,
      photoCount: 0,
      deleted: true,
    });
    expect(merged[2].replyTo?.deleted).toBe(false);
    expect(merged[2].replyTo?.body).toBe("m1");
  });

  it("replaces an optimistic message by its stored copy and keeps others last", () => {
    const pending: DmThreadItem = { ...msg(-5, 1, "mine"), pending: "sending" };
    const other: DmThreadItem = { ...msg(-6, 1, "later"), pending: "sending" };
    const merged = mergeThread(
      [msg(1), pending, other],
      [msg(2, 1, "mine")],
      [],
    );

    expect(merged.map((m) => [m.id, m.pending])).toEqual([
      [1, undefined],
      [2, undefined],
      [-6, "sending"],
    ]);
  });
});

describe("helpers", () => {
  it("finds the last server id, ignoring pending ones", () => {
    expect(
      lastServerId([msg(4), { ...msg(-1), pending: "failed" }, msg(2)]),
    ).toBe(4);
    expect(lastServerId([])).toBe(0);
  });

  it("prepends only unknown older messages", () => {
    expect(
      prependOlder([msg(3)], [msg(1), msg(2), msg(3)]).map((m) => m.id),
    ).toEqual([1, 2, 3]);
  });

  it("finds the last own message the other side read", () => {
    const items = [msg(1, 1), msg(2, 2), msg(3, 1), msg(4, 1)];

    expect(lastSeenOwnId(items, 1, 3)).toBe(3);
    expect(lastSeenOwnId(items, 1, 0)).toBeNull();
  });
});
