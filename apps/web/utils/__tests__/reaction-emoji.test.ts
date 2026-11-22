import { describe, expect, it } from "vitest";

import {
  addRecentReaction,
  DEFAULT_REACTIONS,
  isReactionEmoji,
  parseRecentReactions,
} from "@/utils/reaction-emoji";

describe("default reactions", () => {
  it("keeps every default valid, with 😡 instead of 💪", () => {
    expect(DEFAULT_REACTIONS.every(isReactionEmoji)).toBe(true);
    expect(DEFAULT_REACTIONS).toContain("😡");
    expect(DEFAULT_REACTIONS).not.toContain("💪");
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
