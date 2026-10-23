import type { LoggedSet } from "@/features/workouts/utils/sets";

// A flat query row: one logged set plus whatever the caller joined to it.
export interface SetRow extends LoggedSet {
  exerciseId: number;
}

export type GroupedSetRow<R extends SetRow> = Omit<R, "weightKg" | "reps"> & {
  sets: LoggedSet[];
};

// Groups flat set rows into one entry per exercise, in first-seen order. The
// first row of an exercise supplies the joined fields; sets keep row order, so
// callers order the query by position.
export const groupSetRows = <R extends SetRow>(
  rows: R[],
): GroupedSetRow<R>[] => {
  const groups = new Map<number, GroupedSetRow<R>>();

  for (const row of rows) {
    const { weightKg, reps, ...joined } = row;
    const group = groups.get(row.exerciseId);

    if (group) {
      group.sets.push({ weightKg, reps });
    } else {
      groups.set(row.exerciseId, { ...joined, sets: [{ weightKg, reps }] });
    }
  }

  return [...groups.values()];
};
