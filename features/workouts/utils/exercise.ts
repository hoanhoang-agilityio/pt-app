// "4 hiệp × 10-12", "4 hiệp", "10-12" or "" depending on what was filled in.
export const formatVolume = (sets: number | null, reps: string) => {
  const parts = [sets ? `${sets} hiệp` : "", reps.trim()].filter(Boolean);

  return parts.join(" × ");
};

// Timed exercises have no set logging in v1 (Q3, E4): a number followed by a
// time unit ("30s", "45 sec", "1 phút", "1'", "30\"", "1p30", "30s mỗi bên").
// Unaccented spellings and the curly quotes phone keyboards insert count too.
const TIMED_REPS =
  /\d\s*(?:giây|giay|phút|phut|secs?|min|ph|p|s|['"’”′″])(?!\p{L})/u;

export const isTimedReps = (reps: string) =>
  TIMED_REPS.test(reps.normalize("NFC").toLowerCase());
