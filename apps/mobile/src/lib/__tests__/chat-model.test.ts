import type { ChatMessageView } from "@pt/contracts";
import { describe, expect, it } from "vitest";

import {
  aggregateReactions,
  buildRows,
  type ChatMsg,
  fromCoachMessage,
  GROUP_GAP_MS,
  lastSeenOwnId,
  mergeChanges,
  mergeMessages,
  newestIncomingId,
  optimisticMessage,
} from "../chat-model";

const view = (over: Partial<ChatMessageView> & { id: number }): ChatMessageView => ({
  senderRole: "user",
  senderAdminId: null,
  senderAdminName: null,
  body: `m${over.id}`,
  sticker: null,
  photo: null,
  photos: [],
  clientId: `c${over.id}`,
  createdAt: "2026-11-20T09:00:00.000Z",
  replyTo: null,
  editedAt: null,
  deleted: false,
  updatedAt: "2026-11-20T09:00:00.000Z",
  reactions: [],
  post: null,
  ...over,
});

const msg = (id: number, at: string, over: Partial<ChatMsg> = {}): ChatMsg => ({
  ...fromCoachMessage(view({ id, createdAt: at }), { kind: "trainee" }),
  ...over,
});

describe("adapters", () => {
  it("marks own messages per viewer", () => {
    const fromAdmin = view({ id: 1, senderRole: "admin", senderAdminId: 7 });

    expect(fromCoachMessage(fromAdmin, { kind: "trainee" }).mine).toBe(false);
    expect(fromCoachMessage(fromAdmin, { kind: "admin", adminId: 7 }).mine).toBe(true);
    expect(fromCoachMessage(fromAdmin, { kind: "admin", adminId: 8 }).mine).toBe(false);
  });

  it("uses the cover photo when `photos` is empty", () => {
    const photo = { url: "/v1/chat/photos/1", width: 10, height: 20, alt: "" };

    expect(fromCoachMessage(view({ id: 1, photo }), { kind: "trainee" }).photos).toEqual([
      { url: "/v1/chat/photos/1", width: 10, height: 20 },
    ]);
  });

  it("aggregates reactions with mine", () => {
    expect(
      aggregateReactions(
        [
          { emoji: "👍", reactorKey: "user" },
          { emoji: "👍", reactorKey: "admin:2" },
          { emoji: "❤️", reactorKey: "admin:2" },
        ],
        "user",
      ),
    ).toEqual([
      { emoji: "👍", count: 2, mine: true },
      { emoji: "❤️", count: 1, mine: false },
    ]);
  });
});

describe("mergeMessages / mergeChanges", () => {
  it("replaces the optimistic bubble with the stored message of the same clientId", () => {
    const sending = optimisticMessage({ clientId: "c2", body: "hi" });
    const merged = mergeMessages(
      [msg(1, "2026-11-20T09:00:00Z"), sending],
      [msg(2, "2026-11-20T09:01:00Z", { clientId: "c2" })],
    );

    expect(merged.map((m) => m.id)).toEqual([1, 2]);
    expect(merged.every((m) => m.delivery === "sent")).toBe(true);
  });

  it("keeps pending bubbles after stored ones and never duplicates an id", () => {
    const sending = optimisticMessage({ clientId: "p" , body: "x" });
    const merged = mergeMessages([sending, msg(5, "2026-11-20T09:00:00Z")], [
      msg(5, "2026-11-20T09:00:00Z"),
      msg(4, "2026-11-20T08:00:00Z"),
    ]);

    expect(merged.map((m) => m.id)).toEqual([4, 5, null]);
  });

  it("applies changes in place and skips ids that are not loaded", () => {
    const current = [msg(1, "2026-11-20T09:00:00Z"), msg(2, "2026-11-20T09:01:00Z")];
    const changed = mergeChanges(current, [
      msg(2, "2026-11-20T09:01:00Z", { body: "edited", edited: true }),
      msg(99, "2026-11-20T09:05:00Z"),
    ]);

    expect(changed.map((m) => m.body)).toEqual(["m1", "edited"]);
    expect(changed).toHaveLength(2);
  });
});

describe("read markers", () => {
  it("reports the newest message from the other side", () => {
    const list = [
      msg(1, "2026-11-20T09:00:00Z", { mine: false }),
      msg(2, "2026-11-20T09:01:00Z", { mine: true }),
      msg(3, "2026-11-20T09:02:00Z", { mine: false }),
      msg(4, "2026-11-20T09:03:00Z", { mine: false, kind: "system" }),
    ];

    expect(newestIncomingId(list)).toBe(3);
  });

  it("puts the seen marker under the newest own read message", () => {
    const list = [
      msg(1, "2026-11-20T09:00:00Z", { mine: true }),
      msg(2, "2026-11-20T09:01:00Z", { mine: true }),
      msg(3, "2026-11-20T09:02:00Z", { mine: true }),
    ];

    expect(lastSeenOwnId(list, 2)).toBe(2);
    expect(lastSeenOwnId(list, 0)).toBeNull();
  });
});

describe("buildRows", () => {
  const rowsOf = (list: ChatMsg[]) => buildRows(list);

  it("adds a day separator and splits runs by sender", () => {
    const rows = rowsOf([
      msg(1, "2026-11-20T09:00:00Z", { mine: false, senderKey: "admin:1" }),
      msg(2, "2026-11-20T09:01:00Z", { mine: false, senderKey: "admin:1" }),
      msg(3, "2026-11-20T09:02:00Z", { mine: true, senderKey: "user" }),
    ]);

    expect(rows.map((r) => r.type)).toEqual(["day", "message", "message", "message"]);
    const [, a, b, c] = rows as Extract<(typeof rows)[number], { type: "message" }>[];

    expect([a.isFirstInRun, a.isLastInRun]).toEqual([true, false]);
    expect([b.isFirstInRun, b.isLastInRun]).toEqual([false, true]);
    expect([c.isFirstInRun, c.isLastInRun]).toEqual([true, true]);
  });

  it("breaks a run after a pause longer than 30 minutes, not at exactly 30", () => {
    const base = Date.parse("2026-11-20T09:00:00Z");
    const at = (ms: number) => new Date(base + ms).toISOString();
    const same = { mine: false, senderKey: "admin:1" };
    const exact = rowsOf([
      msg(1, at(0), same),
      msg(2, at(GROUP_GAP_MS), same),
    ]).filter((r) => r.type === "message");
    const over = rowsOf([
      msg(1, at(0), same),
      msg(2, at(GROUP_GAP_MS + 1000), same),
    ]).filter((r) => r.type === "message");

    expect((exact[1] as { isFirstInRun: boolean }).isFirstInRun).toBe(false);
    expect((over[1] as { isFirstInRun: boolean }).isFirstInRun).toBe(true);
  });

  it("starts a new day separator when the local day changes", () => {
    const rows = rowsOf([
      msg(1, new Date(2026, 10, 20, 23, 0).toISOString()),
      msg(2, new Date(2026, 10, 21, 0, 5).toISOString()),
    ]);

    expect(rows.filter((r) => r.type === "day")).toHaveLength(2);
  });
});
