import { describe, expect, it } from "vitest";

import { applyReaction, nextReaction, topReactions } from "../reactions";

const base = {
  counts: [
    { emoji: "👍", count: 2 },
    { emoji: "❤️", count: 1 },
  ],
  total: 3,
  mine: null,
};

describe("applyReaction", () => {
  it("adds my first reaction", () => {
    expect(applyReaction(base, "❤️")).toEqual({
      counts: [
        { emoji: "👍", count: 2 },
        { emoji: "❤️", count: 2 },
      ],
      total: 4,
      mine: "❤️",
    });
  });

  it("adds a new emoji any single emoji is allowed", () => {
    const next = applyReaction(base, "🔥");

    expect(next.counts).toContainEqual({ emoji: "🔥", count: 1 });
    expect(next.total).toBe(4);
  });

  it("replaces my reaction and drops an emoji nobody uses any more", () => {
    const mine = { ...base, mine: "❤️" };
    const next = applyReaction(mine, "👍");

    expect(next.counts).toEqual([{ emoji: "👍", count: 3 }]);
    expect(next.total).toBe(3);
    expect(next.mine).toBe("👍");
  });

  it("removes mine", () => {
    const next = applyReaction({ ...base, mine: "👍" }, null);

    expect(next.counts).toEqual([
      { emoji: "👍", count: 1 },
      { emoji: "❤️", count: 1 },
    ]);
    expect(next.total).toBe(2);
    expect(next.mine).toBeNull();
  });

  it("does nothing when nothing changes", () => {
    expect(applyReaction(base, null)).toBe(base);
  });
});

describe("nextReaction / topReactions", () => {
  it("toggles the emoji I already chose", () => {
    expect(nextReaction("👍", "👍")).toBeNull();
    expect(nextReaction("👍", "😂")).toBe("😂");
    expect(nextReaction(null, "😂")).toBe("😂");
  });

  it("lists the most used emoji", () => {
    expect(topReactions(base, 1)).toEqual(["👍"]);
  });
});
