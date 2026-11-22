import { z } from "zod";

// Reactions (chat, group chat, social posts) take any emoji, not a fixed list.
// What the picker shows first on a small screen:
export const DEFAULT_REACTION_EMOJIS = [
  "❤️",
  "😂",
  "😮",
  "😢",
  "😡",
  "👍",
] as const;

// The stored column is text; keep one reaction small.
export const REACTION_EMOJI_MAX_BYTES = 64;

const pictographic = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

const utf8Length = (value: string) => {
  let bytes = 0;

  for (const char of value) {
    const code = char.codePointAt(0) as number;

    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
};

const graphemeCount = (value: string) => {
  return [...new Intl.Segmenter().segment(value)].length;
};

// Exactly one grapheme cluster (a flag, a keycap, a skin-tone or ZWJ sequence
// each count as one), at most 64 UTF-8 bytes, and a pictographic, regional
// indicator (flag) or keycap in it, so plain letters, digits and punctuation
// are refused. Every emoji stored before this rule still passes.
export const isReactionEmoji = (value: string) =>
  value.length > 0 &&
  utf8Length(value) <= REACTION_EMOJI_MAX_BYTES &&
  graphemeCount(value) === 1 &&
  pictographic.test(value);

export const reactionEmojiSchema = (message: string) =>
  z.string().refine(isReactionEmoji, message);
