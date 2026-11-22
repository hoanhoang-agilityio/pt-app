import {
  parseDecimal,
  SET_LIMITS,
  type ScheduleDayResponse,
  type ScheduleExerciseResponse,
  type SetInput,
  setInputSchema,
  WORKOUT_MESSAGES,
} from "@pt/contracts";

// Pure workout rules shared with the web trainee screens: timed reps, set row
// drafts, parsing and progress. No React Native imports (unit-tested).

export type LoggedSet = { weightKg: number | null; reps: number };

// Timed exercises ("30s", "1 phút") get no set inputs (same rule as the web).
const TIMED_REPS =
  /\d\s*(?:seconds?|minutes?|giây|giay|phút|phut|secs?|mins?|ph|p|s|['"’”′″])(?!\p{L})/u;

export const isTimedReps = (reps: string) =>
  TIMED_REPS.test(reps.normalize("NFC").toLowerCase());

export const calculatePercent = (completed: number, total: number) =>
  total > 0 ? Math.round((completed / total) * 100) : 0;

// 72.5 -> "72,5" for Vietnamese, "72.5" otherwise.
export const formatDecimal = (value: number, locale: string = "vi") => {
  const text = String(Math.round(value * 10) / 10);

  return locale === "vi" ? text.replace(".", ",") : text;
};

// "4 hiệp × 10-12": `setsText` is the localized "4 sets" part.
export const formatVolume = (setsText: string | null, reps: string) =>
  [setsText ?? "", reps.trim()].filter(Boolean).join(" × ");

// "40 kg × 10", or "<bodyweight> × 12".
export const formatSet = (
  { weightKg, reps }: LoggedSet,
  bodyweightLabel: string,
  locale: string = "vi",
) =>
  `${weightKg === null ? bodyweightLabel : `${formatDecimal(weightKg, locale)} kg`} × ${reps}`;

// Set rows only on today's and past days, never for timed exercises.
export const canLogSets = (exercise: { reps: string }, isDue: boolean) =>
  isDue && !isTimedReps(exercise.reps);

// Sets logged before the PT changed the reps to a time stay visible read-only.
export const canShowLoggedSets = (
  exercise: { reps: string },
  loggedSetsCount: number,
) => isTimedReps(exercise.reps) && loggedSetsCount > 0;

export const getLoggedSetsKey = (sets: LoggedSet[]) =>
  sets.map((set) => `${set.weightKg ?? "bw"}x${set.reps}`).join("|");

export type SetRowDraft = { id: number; weight: string; reps: string };
export type SetRowField = "weight" | "reps";

const toDraft = (set: LoggedSet | null, id: number): SetRowDraft => ({
  id,
  weight: !set || set.weightKg === null ? "" : formatDecimal(set.weightKg),
  reps: set ? String(set.reps) : "",
});

// Row n's hint is the previous session's set n.
export const getRowHint = (previous: LoggedSet[], index: number) =>
  previous[index] ?? null;

export const hintToDraftValues = (hint: LoggedSet) => {
  const { weight, reps } = toDraft(hint, 0);

  return { weight, reps };
};

// Saved sets first, then empty rows up to the planned count (1 when none).
export const createInitialRows = (
  loggedSets: LoggedSet[],
  plannedSets: number | null,
): SetRowDraft[] => {
  const saved = loggedSets.slice(0, SET_LIMITS.MAX_ROWS);
  const count = Math.min(
    Math.max(saved.length, plannedSets ?? 1, 1),
    SET_LIMITS.MAX_ROWS,
  );

  return Array.from({ length: count }, (_, index) =>
    toDraft(saved[index] ?? null, index),
  );
};

// An all-blank first save would store nothing; clearing saved sets is allowed.
export const isEmptyFirstSave = (parsedCount: number, loggedCount: number) =>
  parsedCount === 0 && loggedCount === 0;

export type RowError =
  | "missingReps"
  | "weight"
  | "weightStep"
  | "reps"
  | "repsInteger"
  | "invalid";

export type RowsParseResult =
  | { ok: true; sets: SetInput[] }
  | { ok: false; error: RowError | "tooMany"; setNumber: number };

const parseReps = (value: string) =>
  /^\d+([.,]\d+)?$/.test(value) ? Number(value.replace(",", ".")) : Number.NaN;

const errorOfMessage = (message: string | undefined): RowError => {
  switch (message) {
    case WORKOUT_MESSAGES.SET_WEIGHT_RANGE:
      return "weight";
    case WORKOUT_MESSAGES.SET_WEIGHT_STEP:
      return "weightStep";
    case WORKOUT_MESSAGES.SET_REPS_RANGE:
      return "reps";
    case WORKOUT_MESSAGES.SET_REPS_INTEGER:
      return "repsInteger";
    default:
      return "invalid";
  }
};

// Blank rows are dropped, an empty weight is bodyweight; every row is checked
// with the contract schema so the message can name the row before a request.
export const rowsToSetInputs = (rows: SetRowDraft[]): RowsParseResult => {
  const sets: SetInput[] = [];

  for (const [index, row] of rows.entries()) {
    const setNumber = index + 1;
    const weight = row.weight.trim();
    const reps = row.reps.trim();

    if (weight === "" && reps === "") {
      continue;
    }
    if (reps === "") {
      return { ok: false, error: "missingReps", setNumber };
    }
    const weightKg = weight === "" ? null : parseDecimal(weight);
    const repsCount = parseReps(reps);

    if (weightKg !== null && Number.isNaN(weightKg)) {
      return { ok: false, error: "weight", setNumber };
    }
    if (Number.isNaN(repsCount)) {
      return { ok: false, error: "reps", setNumber };
    }
    const parsed = setInputSchema.safeParse({ weightKg, reps: repsCount });

    if (!parsed.success) {
      return {
        ok: false,
        error: errorOfMessage(parsed.error.issues[0]?.message),
        setNumber,
      };
    }
    sets.push(parsed.data);
  }
  return sets.length > SET_LIMITS.MAX_ROWS
    ? { ok: false, error: "tooMany", setNumber: 0 }
    : { ok: true, sets };
};

export type Progress = { completed: number; total: number; percent: number };

const toProgress = (completed: number, total: number): Progress => ({
  completed,
  total,
  percent: calculatePercent(completed, total),
});

type ProgressDay = Pick<ScheduleDayResponse, "exercises"> & {
  exercises: Pick<ScheduleExerciseResponse, "completedAt">[];
};

export const getDayProgress = (day: ProgressDay) =>
  toProgress(
    day.exercises.filter((exercise) => exercise.completedAt !== null).length,
    day.exercises.length,
  );

export const getWeekProgress = (days: ProgressDay[]) => {
  const parts = days.map(getDayProgress);

  return toProgress(
    parts.reduce((sum, part) => sum + part.completed, 0),
    parts.reduce((sum, part) => sum + part.total, 0),
  );
};

export const isDayComplete = (day: ProgressDay) => {
  const { completed, total } = getDayProgress(day);

  return total > 0 && completed === total;
};

export const hasDayContent = (day: {
  title: string;
  note: string;
  exercises: unknown[];
}) => Boolean(day.title || day.note || day.exercises.length);
