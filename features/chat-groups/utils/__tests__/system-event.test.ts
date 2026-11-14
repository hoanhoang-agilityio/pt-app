import { describe, expect, it } from "vitest";

import {
  parseSystemEvent,
  serializeSystemEvent,
  type SystemEvent,
  systemEventKeys,
  toSystemLine,
} from "@/features/chat-groups/utils/system-event";

const events: SystemEvent[] = [
  {
    type: "member_added",
    actorKey: "admin:1",
    memberKeys: ["user:2", "user:3"],
  },
  { type: "member_removed", actorKey: "admin:1", memberKey: "user:2" },
  { type: "member_left", memberKey: "user:2" },
  { type: "renamed", actorKey: "admin:1", from: "A", to: "B" },
  { type: "avatar_changed", actorKey: "admin:1" },
  { type: "managers_only", actorKey: "admin:1", enabled: true },
  {
    type: "pt_changed",
    userId: 4,
    fromPtId: 2,
    toPtId: null,
    resolution: { choice: "keep", byAdminId: 1, at: 1000 },
  },
];

const nameOf = (key: string) => `<${key}>`;

describe("system event JSON", () => {
  it.each(events)("round trips $type", (event) => {
    expect(parseSystemEvent(serializeSystemEvent(event))).toEqual(event);
  });

  it("refuses to store an invalid event", () => {
    expect(() =>
      serializeSystemEvent({
        type: "member_left",
        memberKey: "nobody",
      } as SystemEvent),
    ).toThrow();
  });

  it.each([
    null,
    "",
    "not json",
    "[]",
    '{"type":"something_new"}',
    '{"type":"member_left"}',
    '{"type":"member_left","memberKey":"user:0"}',
  ])("reads %j as no event", (raw) => {
    expect(parseSystemEvent(raw)).toBeNull();
  });
});

describe("toSystemLine", () => {
  it("falls back to a neutral line for an unreadable row", () => {
    expect(toSystemLine(null, nameOf)).toEqual({
      key: "systemLine.unknown",
      params: {},
    });
  });

  it("names the people of a member_added line", () => {
    expect(toSystemLine(events[0], nameOf)).toEqual({
      key: "systemLine.member_added",
      params: { actor: "<admin:1>", members: "<user:2>, <user:3>", count: 2 },
    });
  });

  it("picks the managers-only key by the switch", () => {
    expect(toSystemLine(events[5], nameOf).key).toBe(
      "systemLine.managers_only_on",
    );
    expect(
      toSystemLine({ ...events[5], enabled: false } as SystemEvent, nameOf).key,
    ).toBe("systemLine.managers_only_off");
  });

  it("shows the outcome and who chose on a resolved PT change", () => {
    expect(toSystemLine(events[6], nameOf)).toEqual({
      key: "systemLine.pt_changed_keep",
      params: {
        member: "<user:4>",
        from: "<admin:2>",
        to: "",
        by: "<admin:1>",
      },
    });
  });

  it("keeps an unresolved PT change open", () => {
    const open = { ...events[6], resolution: null } as SystemEvent;

    expect(toSystemLine(open, nameOf).key).toBe("systemLine.pt_changed_open");
  });
});

describe("systemEventKeys", () => {
  it("lists every key a line names, for one name lookup", () => {
    expect(systemEventKeys(events[0])).toEqual(["admin:1", "user:2", "user:3"]);
    expect(systemEventKeys(events[6]).sort()).toEqual([
      "admin:1",
      "admin:2",
      "user:4",
    ]);
  });
});
