export type SetUnit = "reps" | "seconds";

// One set of an exercise: reps or seconds (per `unit`), an optional weight
// and an optional short note. The value of the other unit is always null.
export interface TrainingNoteSet {
  position: number;
  unit: SetUnit;
  reps: number | null;
  durationSec: number | null;
  weightKg: number | null;
  note: string | null;
}

export interface TrainingNoteItem {
  id: number;
  position: number;
  exerciseName: string;
  sets: TrainingNoteSet[];
}

export interface TrainingNote {
  id: number;
  // "YYYY-MM-DD"
  date: string;
  title: string | null;
  note: string | null;
  items: TrainingNoteItem[];
}

export type TrainingNoteRange = "all" | "week" | "month";

// Notes of one day, newest first; `label` is the formatted day heading.
export interface TrainingNoteGroup {
  date: string;
  label: string;
  notes: TrainingNote[];
}
