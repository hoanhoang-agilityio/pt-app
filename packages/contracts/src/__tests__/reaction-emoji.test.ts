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
    for (const emoji of [
      "🇻🇳",
      "👍🏽",
      "👨‍👩‍👧‍👦",
      "🏳️‍🌈",
      "1️⃣",
      "#️⃣",
      "🔥",
      "🥹",
    ]) {
      expect(isReactionEmoji(emoji), emoji).toBe(true);
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
