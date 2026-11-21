import { describe, expect, it } from "vitest";

import {
  addRecentReaction,
  DEFAULT_REACTIONS,
  isReactionEmoji,
  parseRecentReactions,
  reactionEmojiSchema,
} from "@/utils/reaction-emoji";

describe("isReactionEmoji", () => {
  it.each([
    ["red heart", "❤️"],
    ["angry face", "😡"],
    ["thumbs up with skin tone", "👍🏽"],
    ["family (ZWJ sequence)", "👨‍👩‍👧"],
    ["flag", "🇻🇳"],
    ["keycap", "1️⃣"],
    ["flexed biceps", "💪"],
  ])("accepts %s", (_name, value) => {
    expect(isReactionEmoji(value)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["text", "hi"],
    ["two emoji", "😂😂"],
    ["text before an emoji", "a😂"],
    ["a space", " "],
    ["a digit alone", "1"],
    ["a long string", "😂".repeat(10)],
    ["a long text", "x".repeat(100)],
  ])("rejects %s", (_name, value) => {
    expect(isReactionEmoji(value)).toBe(false);
  });

  it("keeps every default reaction valid", () => {
    expect(DEFAULT_REACTIONS.every(isReactionEmoji)).toBe(true);
    expect(DEFAULT_REACTIONS).toContain("😡");
    expect(DEFAULT_REACTIONS).not.toContain("💪");
  });

  it("backs the schema", () => {
    expect(reactionEmojiSchema.safeParse("🔥").success).toBe(true);
    expect(reactionEmojiSchema.safeParse("fire").success).toBe(false);
    expect(reactionEmojiSchema.safeParse(1).success).toBe(false);
  });
});

describe("recent reactions", () => {
  it("puts the newest first, drops a repeat and keeps at most 8", () => {
    expect(addRecentReaction(["😂", "🔥"], "🔥")).toEqual(["🔥", "😂"]);

    const full = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];

    expect(addRecentReaction(full, "🔥")).toEqual(["🔥", ...full.slice(0, 7)]);
  });

  it("reads stored values defensively", () => {
    expect(parseRecentReactions(null)).toEqual([]);
    expect(parseRecentReactions("not json")).toEqual([]);
    expect(parseRecentReactions('{"a":1}')).toEqual([]);
    expect(parseRecentReactions('["🔥","hi",3,"😂😂","👍"]')).toEqual([
      "🔥",
      "👍",
    ]);
  });
});
