import {
  SET_LIMITS,
  WORKOUT_MESSAGES,
} from "@/features/workouts/constants/messages";
import {
  describeMissingReps,
  SET_LOGGER_COPY,
} from "@/features/workouts/constants/set-logger";
import type { Exercise } from "@/features/workouts/types/workout";
import { isTimedReps } from "@/features/workouts/utils/exercise";
import {
  exerciseSetsSchema,
  type LoggedSet,
  type SetInput,
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
  weight: set?.weightKg === null || !set ? "" : String(set.weightKg),
  reps: set ? String(set.reps) : "",
});

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

// Vietnamese keyboards may type "42,5"; both separators mean 42.5.
const parseNumber = (value: string) => Number(value.trim().replace(",", "."));

// Turns the rows into the action's input. Fully blank rows are dropped, an
// empty weight is bodyweight (Q3). Range and step use the server's schema so
// the trainee sees the same message before a round trip; the action still
// validates on its own.
export const rowsToSetInputs = (rows: SetRowDraft[]): RowsParseResult => {
  const sets: SetInput[] = [];

  for (const [index, row] of rows.entries()) {
    const weight = row.weight.trim();
    const reps = row.reps.trim();

    if (weight === "" && reps === "") {
      continue;
    }
    if (reps === "") {
      return { ok: false, message: describeMissingReps(index + 1) };
    }

    const weightKg = weight === "" ? null : parseNumber(weight);
    const repsCount = parseNumber(reps);

    if (weightKg !== null && !Number.isFinite(weightKg)) {
      return { ok: false, message: WORKOUT_MESSAGES.SET_WEIGHT_RANGE };
    }
    if (!Number.isFinite(repsCount)) {
      return { ok: false, message: WORKOUT_MESSAGES.SET_REPS_RANGE };
    }

    sets.push({ weightKg, reps: repsCount });
  }

  const parsed = exerciseSetsSchema.safeParse(sets);

  return parsed.success
    ? { ok: true, sets: parsed.data }
    : {
        ok: false,
        message:
          parsed.error.issues[0]?.message ?? WORKOUT_MESSAGES.INVALID_INPUT,
      };
};

const formatKg = (kg: number) => String(kg).replace(".", ",");

// "40 kg × 10", "42,5 kg × 8" or "Tự trọng × 12".
export const formatSet = ({ weightKg, reps }: LoggedSet) =>
  `${weightKg === null ? SET_LOGGER_COPY.BODYWEIGHT : `${formatKg(weightKg)} ${SET_LOGGER_COPY.WEIGHT_UNIT}`} × ${reps}`;

// Set rows only on today's and past days (Q7) and never for timed exercises
// such as "30s" (Q3).
export const canLogSets = (exercise: Pick<Exercise, "reps">, isDue: boolean) =>
  isDue && !isTimedReps(exercise.reps);
