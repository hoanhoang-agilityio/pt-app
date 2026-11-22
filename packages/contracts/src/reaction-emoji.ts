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

// One whole grapheme must have an emoji shape; a pictograph followed by stray
// combining marks, or a lone keycap mark, is not an emoji.
const pictograph =
  "\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?(?:[\\u{E0020}-\\u{E007E}]+\\u{E007F})?";
const emojiShape = new RegExp(
  `^(?:${pictograph}(?:\\u200D${pictograph})*|\\p{Regional_Indicator}{2}|[0-9#*]\\uFE0F?\\u20E3)$`,
  "u",
);

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
// each count as one), at most 64 UTF-8 bytes, and the whole cluster is a
// pictograph sequence, a flag (two regional indicators) or a keycap, so plain
// letters, digits, punctuation and stacked combining marks are refused.
export const isReactionEmoji = (value: string) =>
  value.length > 0 &&
  utf8Length(value) <= REACTION_EMOJI_MAX_BYTES &&
  graphemeCount(value) === 1 &&
  emojiShape.test(value);

export const reactionEmojiSchema = (message: string) =>
  z.string().refine(isReactionEmoji, message);
