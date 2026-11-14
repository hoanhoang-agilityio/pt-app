import { describe, expect, it } from "vitest";

import {
  parseAdminUnread,
  parseGroupUnread,
  parseUserUnread,
} from "@/features/chat/utils/unread-payload";

const groups = {
  total: 5,
  perGroup: [
    { groupId: 3, unread: 2 },
    { groupId: 7, unread: 3 },
  ],
};

describe("parseGroupUnread", () => {
  it("reads the groups field", () => {
    expect(parseGroupUnread({ groups })).toEqual(groups);
  });

  it.each([null, undefined, 5, "x", {}, { groups: null }, { groups: [] }])(
    "falls back to nothing for %j",
    (data) => {
      expect(parseGroupUnread(data)).toEqual({ total: 0, perGroup: [] });
    },
  );

  it("drops rows without a numeric group id and bad counts", () => {
    expect(
      parseGroupUnread({
        groups: {
          total: "7",
          perGroup: [
            { groupId: "1", unread: 2 },
            { groupId: 4, unread: "x" },
            null,
            { groupId: 9, unread: 1 },
          ],
        },
      }),
    ).toEqual({
      total: 0,
      perGroup: [
        { groupId: 4, unread: 0 },
        { groupId: 9, unread: 1 },
      ],
    });
  });
});

describe("existing fields are unchanged", () => {
  it("parses the trainee payload with and without groups", () => {
    const base = { count: 4, coachCount: 3, latestLoudIncomingId: 12 };

    expect(parseUserUnread(base)).toEqual({
      ...base,
      groups: { total: 0, perGroup: [] },
    });
    expect(parseUserUnread({ ...base, groups })).toEqual({ ...base, groups });
  });

  it("parses the admin payload with and without groups", () => {
    const row = {
      userId: 1,
      conversationId: 2,
      unread: 3,
      latestLoudIncomingId: null,
    };

    expect(parseAdminUnread({ count: 3, perTrainee: [row] })).toEqual({
      count: 3,
      perTrainee: [row],
      groups: { total: 0, perGroup: [] },
    });
    expect(
      parseAdminUnread({ count: 3, perTrainee: [row], groups }).groups,
    ).toEqual(groups);
  });
});
