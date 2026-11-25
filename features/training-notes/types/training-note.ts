export interface TrainingNoteItem {
  id: number;
  position: number;
  exerciseName: string;
  sets: number | null;
  reps: number | null;
  durationSec: number | null;
  weightKg: number | null;
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
