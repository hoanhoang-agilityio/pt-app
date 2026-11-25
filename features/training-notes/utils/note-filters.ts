import type { TrainingNoteRange } from "@/features/training-notes/types/training-note";
import { addDays, getWeekStart } from "@/utils/week";

export const TRAINING_NOTE_RANGES: TrainingNoteRange[] = [
  "all",
  "week",
  "month",
];

export const parseTrainingNoteRange = (
  value: string | undefined,
): TrainingNoteRange =>
  TRAINING_NOTE_RANGES.find((range) => range === value) ?? "all";

// Inclusive "YYYY-MM-DD" bounds of "Tuần này" (Monday to Sunday) and "Tháng
// này" around `today`; null for "all".
export const getRangeBounds = (
  range: TrainingNoteRange,
  today: string,
): { from: string; to: string } | null => {
  if (range === "week") {
    const from = getWeekStart(today);

    return { from, to: addDays(from, 6) };
  }
  if (range === "month") {
    const month = today.slice(0, 7);

    return { from: `${month}-01`, to: `${month}-31` };
  }
  return null;
};
