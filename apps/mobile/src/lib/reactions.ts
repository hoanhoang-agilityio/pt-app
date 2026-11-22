// Optimistic update of a post's reaction summary when I react (or remove my
// reaction). Mirrors what the API computes, so the UI is right before the
// answer arrives.

export type ReactionSummary = {
  counts: { emoji: string; count: number }[];
  total: number;
  mine: string | null;
};

export const applyReaction = (
  summary: ReactionSummary,
  next: string | null,
): ReactionSummary => {
  if (summary.mine === next) {
    return summary;
  }
  const counts = summary.counts.map((entry) => ({ ...entry }));
  let total = summary.total;

  if (summary.mine !== null) {
    const index = counts.findIndex((entry) => entry.emoji === summary.mine);

    if (index >= 0) {
      counts[index].count -= 1;
      total -= 1;
    }
  }
  if (next !== null) {
    const entry = counts.find((item) => item.emoji === next);

    if (entry) {
      entry.count += 1;
    } else {
      counts.push({ emoji: next, count: 1 });
    }
    total += 1;
  }
  return {
    counts: counts.filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count),
    total: Math.max(0, total),
    mine: next,
  };
};

// Tapping the emoji I already chose removes it; any other replaces it.
export const nextReaction = (mine: string | null, tapped: string) =>
  mine === tapped ? null : tapped;

// The few emoji shown in the summary under a post.
export const topReactions = (summary: ReactionSummary, top = 3) =>
  summary.counts.slice(0, top).map((entry) => entry.emoji);
