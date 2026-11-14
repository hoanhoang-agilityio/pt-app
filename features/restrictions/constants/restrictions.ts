export const RESTRICTION_LEVELS = ["restricted", "suspended"] as const;

// How long a block lasts; "permanent" has no end date.
export const RESTRICTION_DURATIONS = ["24h", "7d", "30d", "permanent"] as const;

export const RESTRICTION_REASON_MAX = 300;

const HOUR_MS = 60 * 60 * 1000;

// Milliseconds added to "now" for each timed duration.
export const RESTRICTION_DURATION_MS = {
  "24h": 24 * HOUR_MS,
  "7d": 7 * 24 * HOUR_MS,
  "30d": 30 * 24 * HOUR_MS,
} as const;
