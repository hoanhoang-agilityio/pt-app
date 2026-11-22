import { describe, expect, it } from "vitest";

import { applyMessageReaction, type ChatMsg, myReactionOf } from "../chat-model";

describe("applyMessageReaction", () => {
  const reactions = [
    { emoji: "👍", count: 2, mine: true },
    { emoji: "❤️", count: 1, mine: false },
  ];

  it("replaces my reaction", () => {
    expect(applyMessageReaction(reactions, "❤️")).toEqual([
      { emoji: "👍", count: 1, mine: false },
      { emoji: "❤️", count: 2, mine: true },
    ]);
  });

  it("removes mine and drops an emoji with no one left", () => {
    expect(applyMessageReaction([{ emoji: "👍", count: 1, mine: true }], null)).toEqual([]);
  });

  it("adds a brand new emoji", () => {
    expect(applyMessageReaction([], "🔥")).toEqual([{ emoji: "🔥", count: 1, mine: true }]);
  });

  it("finds my reaction", () => {
    expect(myReactionOf({ reactions } as ChatMsg)).toBe("👍");
    expect(myReactionOf({ reactions: [] } as unknown as ChatMsg)).toBeNull();
  });
});
