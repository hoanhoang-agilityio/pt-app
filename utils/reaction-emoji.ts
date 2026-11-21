import { z } from "zod";

// The quick reactions shown in every reaction row; any other emoji comes from
// the full picker.
export const DEFAULT_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"] as const;

// Longest stored reaction: two-skin-tone ZWJ sequences (about 35 bytes) fit.
export const REACTION_EMOJI_MAX_BYTES = 64;

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const FLAG = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP = /^[0-9#*]️?⃣$/u;

const encoder = new TextEncoder();
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// True for exactly one emoji (with its skin tone, ZWJ or flag parts): not
// text, not two emoji, not an empty or oversized string.
export const isReactionEmoji = (value: string): boolean => {
  if (
    value.length === 0 ||
    encoder.encode(value).length > REACTION_EMOJI_MAX_BYTES
  ) {
    return false;
  }

  const graphemes = [...segmenter.segment(value)];

  if (graphemes.length !== 1) {
    return false;
  }

  const grapheme = graphemes[0].segment;

  return (
    PICTOGRAPHIC.test(grapheme) || FLAG.test(grapheme) || KEYCAP.test(grapheme)
  );
};

export const reactionEmojiSchema = z
  .string()
  .refine(isReactionEmoji, "Invalid emoji");

export const RECENT_REACTIONS_KEY = "pt-recent-reactions";
export const RECENT_REACTIONS_MAX = 8;

// The emoji just picked goes first; an earlier copy of it moves up.
export const addRecentReaction = (
  recent: readonly string[],
  emoji: string,
): string[] =>
  [emoji, ...recent.filter((item) => item !== emoji)].slice(
    0,
    RECENT_REACTIONS_MAX,
  );

// Reads the stored list defensively: storage may be blocked, empty or hold
// anything another version wrote.
export const parseRecentReactions = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
          .filter(
            (item): item is string =>
              typeof item === "string" && isReactionEmoji(item),
          )
          .slice(0, RECENT_REACTIONS_MAX)
      : [];
  } catch {
    return [];
  }
};
