// "4 hiệp × 10-12", "4 hiệp", "10-12" or "" depending on what was filled in.
export const formatVolume = (sets: number | null, reps: string) => {
  const parts = [sets ? `${sets} hiệp` : "", reps.trim()].filter(Boolean);

  return parts.join(" × ");
};

// Timed exercises ("30s", "45 sec", "1 phút", "1'", "30\"") have no set
// logging in v1 (Q3, E4): a number followed by a time unit at the end.
const TIMED_REPS = /\d\s*(?:s|sec|giây|p|ph|phút|'|")$/u;

export const isTimedReps = (reps: string) =>
  TIMED_REPS.test(reps.normalize("NFC").trim().toLowerCase());
