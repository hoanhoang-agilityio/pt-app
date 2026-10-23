import { formatDecimal } from "@/features/nutrition/utils/energy";
import {
  SET_LIMITS,
  WORKOUT_MESSAGES,
} from "@/features/workouts/constants/messages";
import {
  describeMissingReps,
  describeRowError,
  SET_LOGGER_COPY,
} from "@/features/workouts/constants/set-logger";
import type { Exercise } from "@/features/workouts/types/workout";
import { isTimedReps } from "@/features/workouts/utils/exercise";
import {
  type LoggedSet,
  type SetInput,
  setInputSchema,
} from "@/features/workouts/utils/sets";

// One editable row of the set logger. Inputs stay strings while typing so a
// half-typed "42," is not lost; `id` is a stable React key.
export interface SetRowDraft {
  id: number;
  weight: string;
  reps: string;
}

export type SetRowField = "weight" | "reps";

export type RowsParseResult =
  { ok: true; sets: SetInput[] } | { ok: false; message: string };

const toDraft = (set: LoggedSet | null, id: number): SetRowDraft => ({
  id,
  weight: !set || set.weightKg === null ? "" : formatDecimal(set.weightKg),
  reps: set ? String(set.reps) : "",
});

// Row n's hint is the previous session's set n (E7); rows past the previous
// count have none.
export const getRowHint = (
  previousSets: LoggedSet[],
  index: number,
): LoggedSet | null => previousSets[index] ?? null;

// The weight and reps strings a tapped hint writes into a row; a bodyweight
// hint leaves the weight empty (Q3).
export const hintToDraftValues = (
  hint: LoggedSet,
): Pick<SetRowDraft, "weight" | "reps"> => {
  const { weight, reps } = toDraft(hint, 0);

  return { weight, reps };
};

// Saved sets win; otherwise one empty row per planned set, 1 when the PT left
// `sets` empty (E1, Q1), never more than the row limit (Q14).
export const createInitialRows = (
  loggedSets: LoggedSet[],
  plannedSets: number | null,
): SetRowDraft[] => {
  if (loggedSets.length > 0) {
    return loggedSets
      .slice(0, SET_LIMITS.MAX_ROWS)
      .map((set, index) => toDraft(set, index));
  }

  const count = Math.min(Math.max(plannedSets ?? 1, 1), SET_LIMITS.MAX_ROWS);

  return Array.from({ length: count }, (_, index) => toDraft(null, index));
};

// Plain decimals only ("42", "42.5", "42,5"): `Number` alone would also take
// "1e2" or "0x14". Vietnamese keyboards type the comma.
const DECIMAL_PATTERN = /^\d+([.,]\d+)?$/;

const parseDecimal = (value: string) =>
  DECIMAL_PATTERN.test(value) ? Number(value.replace(",", ".")) : Number.NaN;

// Turns the rows into the action's input. Fully blank rows are dropped, an
// empty weight is bodyweight (Q3). Each row is checked with the server's
// schema so the toast names the row before any round trip; the action still
// validates on its own.
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
      return { ok: false, message: describeMissingReps(setNumber) };
    }

    const weightKg = weight === "" ? null : parseDecimal(weight);
    const repsCount = parseDecimal(reps);

    if (weightKg !== null && Number.isNaN(weightKg)) {
      return {
        ok: false,
        message: describeRowError(setNumber, WORKOUT_MESSAGES.SET_WEIGHT_RANGE),
      };
    }
    if (Number.isNaN(repsCount)) {
      return {
        ok: false,
        message: describeRowError(setNumber, WORKOUT_MESSAGES.SET_REPS_RANGE),
      };
    }

    const parsed = setInputSchema.safeParse({ weightKg, reps: repsCount });

    if (!parsed.success) {
      return {
        ok: false,
        message: describeRowError(
          setNumber,
          parsed.error.issues[0]?.message ?? WORKOUT_MESSAGES.INVALID_INPUT,
        ),
      };
    }
    sets.push(parsed.data);
  }

  return sets.length > SET_LIMITS.MAX_ROWS
    ? { ok: false, message: WORKOUT_MESSAGES.SET_TOO_MANY }
    : { ok: true, sets };
};

// "40 kg × 10", "42,5 kg × 8" or "Tự trọng × 12".
export const formatSet = ({ weightKg, reps }: LoggedSet) =>
  `${weightKg === null ? SET_LOGGER_COPY.BODYWEIGHT : `${formatDecimal(weightKg)} ${SET_LOGGER_COPY.WEIGHT_UNIT}`} × ${reps}`;

// Set rows only on today's and past days (Q7) and never for timed exercises
// such as "30s" (Q3).
export const canLogSets = (exercise: Pick<Exercise, "reps">, isDue: boolean) =>
  isDue && !isTimedReps(exercise.reps);

// Changes whenever the saved sets change; used as the logger's React key.
export const getLoggedSetsKey = (sets: LoggedSet[]) =>
  sets.map((set) => `${set.weightKg ?? "bw"}x${set.reps}`).join("|");
