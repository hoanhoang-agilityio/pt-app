import { SETS_PER_ITEM_MAX } from "@/features/training-notes/constants/limits";
import type { TrainingNoteSet } from "@/features/training-notes/types/training-note";

// The legacy columns of an exercise row (one count, reps/seconds and weight
// for every set), written before sets had their own table.
interface LegacyItemRow {
  sets: number | null;
  reps: number | null;
  durationSec: number | null;
  weightKg: number | null;
}

interface SetRow {
  position: number;
  reps: number | null;
  durationSec: number | null;
  weightKg: number | null;
  note: string | null;
}

// A set row has no unit column: seconds set means a timed set.
const toSet = (
  row: Omit<SetRow, "position">,
  position: number,
): TrainingNoteSet => ({
  position,
  unit: row.durationSec === null ? "reps" : "seconds",
  reps: row.reps,
  durationSec: row.durationSec,
  weightKg: row.weightKg,
  note: row.note,
});

// The legacy sets of an item: `sets` identical rows, one row when there is a
// value but no count, none when the row holds nothing. The count is capped so
// a corrupt value cannot expand into a huge list.
export const getLegacySets = (item: LegacyItemRow): TrainingNoteSet[] => {
  const hasValue =
    item.reps !== null || item.durationSec !== null || item.weightKg !== null;
  const count =
    item.sets !== null && item.sets >= 1
      ? Math.min(Math.floor(item.sets), SETS_PER_ITEM_MAX)
      : hasValue
        ? 1
        : 0;

  return Array.from({ length: count }, (_, position) =>
    toSet({ ...item, note: null }, position),
  );
};

// The sets of one exercise: its own rows in order, else what the legacy
// columns say.
export const toItemSets = (
  item: LegacyItemRow,
  setRows: SetRow[],
): TrainingNoteSet[] =>
  setRows.length > 0
    ? [...setRows]
        .sort((a, b) => a.position - b.position)
        .map((row) => toSet(row, row.position))
    : getLegacySets(item);
