import { DEFAULT_REACTION_EMOJIS, isReactionEmoji } from "@pt/contracts";

// The validation and the default set live in @pt/contracts (the API checks the
// same rule); this file adds the picker's "recently used" list.
export { isReactionEmoji };
export const DEFAULT_REACTIONS = DEFAULT_REACTION_EMOJIS;

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
