import { describe, expect, it } from "vitest";

import {
  getGiphySuggestQuery,
  getSuggestQuery,
  matchStickerSuggestions,
  normalizeSuggestText,
} from "../sticker-suggest";

describe("normalizeSuggestText", () => {
  it("drops accents, maps đ and collapses spaces", () => {
    expect(normalizeSuggestText("  Cố  lên, Đại!  ")).toBe("co len dai");
  });
});

describe("getSuggestQuery", () => {
  it("skips commands, empty and long text", () => {
    expect(getSuggestQuery("/imlang gym")).toBeNull();
    expect(getSuggestQuery("   ")).toBeNull();
    expect(getSuggestQuery("a b c d e")).toBeNull();
    expect(getSuggestQuery("x".repeat(31))).toBeNull();
  });

  it("recognises emoji-only text", () => {
    expect(getSuggestQuery("💪")?.kind).toBe("emoji");
    expect(getSuggestQuery("gym")?.kind).toBe("text");
  });
});

describe("matchStickerSuggestions", () => {
  it("matches a Vietnamese phrase without accents", () => {
    const ids = matchStickerSuggestions("cơ bắp", "vi").map((s) => s.id);

    expect(ids).toContain("flexed-biceps");
  });

  it("matches English words for every locale and an emoji", () => {
    expect(matchStickerSuggestions("gym", "vi").map((s) => s.id)).toContain("flexed-biceps");
    expect(matchStickerSuggestions("💪", "en").map((s) => s.id)).toContain("flexed-biceps");
  });

  it("ranks an exact match above a prefix and boosts recent stickers", () => {
    const ranked = matchStickerSuggestions("gym", "en").map((s) => s.id);
    const boosted = matchStickerSuggestions("gym", "en", ["person-lifting-weights"]).map((s) => s.id);

    expect(boosted[0]).toBe("person-lifting-weights");
    expect(ranked.length).toBeGreaterThan(1);
  });

  it("finds nothing for unrelated text", () => {
    expect(matchStickerSuggestions("zzzqqq", "vi")).toEqual([]);
  });
});

describe("getGiphySuggestQuery", () => {
  it("needs short non-emoji text", () => {
    expect(getGiphySuggestQuery("hello   world")).toBe("hello world");
    expect(getGiphySuggestQuery("😀")).toBeNull();
    expect(getGiphySuggestQuery("a")).toBeNull();
  });
});
