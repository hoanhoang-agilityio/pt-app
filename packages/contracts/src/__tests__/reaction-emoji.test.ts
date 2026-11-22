import {
  chatReactRequestSchema,
  DEFAULT_REACTION_EMOJIS,
  groupReactRequestSchema,
  isReactionEmoji,
  socialReactionRequestSchema,
} from "../index.js";
import { describe, expect, it } from "vitest";

describe("isReactionEmoji", () => {
  it("accepts the defaults and the emoji already stored (including 💪)", () => {
    for (const emoji of [...DEFAULT_REACTION_EMOJIS, "💪"]) {
      expect(isReactionEmoji(emoji), emoji).toBe(true);
    }
    expect(DEFAULT_REACTION_EMOJIS).toEqual([
      "❤️",
      "😂",
      "😮",
      "😢",
      "😡",
      "👍",
    ]);
  });

  it("accepts one cluster: flags, skin tones, ZWJ families and keycaps", () => {
    for (const emoji of ["🇻🇳", "👍🏽", "👨‍👩‍👧‍👦", "🏳️‍🌈", "1️⃣", "#️⃣", "🔥", "🥹"]) {
      expect(isReactionEmoji(emoji), emoji).toBe(true);
    }
  });

  it("accepts the emoji shapes: VS16, skin tone, ZWJ, flag, keycap, tag flag", () => {
    for (const emoji of ["❤️", "👍🏽", "👨‍👩‍👧", "🇻🇳", "1️⃣", "🏴󠁧󠁢󠁳󠁣󠁴󠁿"]) {
      expect(isReactionEmoji(emoji), emoji).toBe(true);
    }
  });

  it("needs U+FE0F after a text-presentation base, so a bare symbol is refused", () => {
    for (const emoji of ["©️", "®️", "™️", "‼️", "↔️", "❤️", "🇻🇳"]) {
      expect(isReactionEmoji(emoji), emoji).toBe(true);
    }
    for (const value of ["©", "®", "™", "‼", "↔", "❤", "♥"]) {
      expect(isReactionEmoji(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("refuses stacked combining marks, a lone keycap mark and other junk", () => {
    for (const value of [
      "😀" + "\u0301".repeat(10),
      "\u20E3",
      "a",
      "👍👍",
      "1\u20E3\u0301",
      "🇻",
    ]) {
      expect(isReactionEmoji(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("refuses two clusters, empty, letters, digits and punctuation", () => {
    for (const value of [
      "",
      "👍👍",
      "😂 ",
      " 😂",
      "a",
      "1",
      "#",
      "!",
      "ab",
      "😂a",
    ]) {
      expect(isReactionEmoji(value), JSON.stringify(value)).toBe(false);
    }
  });

  it("refuses a cluster longer than 64 UTF-8 bytes", () => {
    // 15 joined emoji is one cluster of far more than 64 bytes.
    const long = Array.from({ length: 15 }, () => "👩").join("‍");

    expect([...new Intl.Segmenter().segment(long)]).toHaveLength(1);
    expect(isReactionEmoji(long)).toBe(false);
  });
});

describe("reaction requests", () => {
  it("take any emoji in chat, group chat and social", () => {
    for (const schema of [
      chatReactRequestSchema,
      groupReactRequestSchema,
      socialReactionRequestSchema,
    ]) {
      expect(schema.safeParse({ emoji: "🥹" }).success).toBe(true);
      expect(schema.safeParse({ emoji: "💪" }).success).toBe(true);
      expect(schema.safeParse({ emoji: "x" }).success).toBe(false);
      expect(schema.safeParse({ emoji: "👍👍" }).success).toBe(false);
      expect(schema.safeParse({}).success).toBe(false);
    }
  });
});
