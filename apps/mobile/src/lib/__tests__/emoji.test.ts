import { describe, expect, it } from "vitest";

import { EMOJI_GRID, isSingleEmoji, REACTION_BAR } from "../emoji";

describe("isSingleEmoji", () => {
  it.each([
    "👍",
    "❤️",
    "😡",
    "👍🏽",
    "🏳️‍🌈",
    "👨‍👩‍👧‍👦",
    "🇻🇳",
    "1️⃣",
    "✌️",
  ])("accepts %s", (value) => {
    expect(isSingleEmoji(value)).toBe(true);
  });

  it.each(["", "a", "ab", "👍👍", "👍a", " 👍", "1", "🇻", "‍", "text 😀"])(
    "rejects %j",
    (value) => {
      expect(isSingleEmoji(value)).toBe(false);
    },
  );

  it("accepts every emoji the picker offers", () => {
    for (const emoji of [...REACTION_BAR, ...EMOJI_GRID]) {
      expect(isSingleEmoji(emoji), emoji).toBe(true);
    }
  });
});
