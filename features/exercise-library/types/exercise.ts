import type { MuscleKey } from "@/features/exercise-library/constants/muscles";

export type ExerciseSource = "all" | "mine" | "builtin";

// A compact row for lists and the picker. `ref` is "b:<id>" (built-in) or
// "c:<id>" (custom).
export interface ExerciseRow {
  ref: string;
  name: string;
  primary: MuscleKey[];
  secondary: MuscleKey[];
  equipment: string | null;
  imageUrl: string | null;
  isCustom: boolean;
}

export interface ExerciseDetail extends ExerciseRow {
  // One step per entry; a custom exercise's text is split by line.
  instructions: string[];
  category: string | null;
  level: string | null;
  // Row id of a custom exercise, null for a built-in.
  customId: number | null;
}

export interface ExerciseMuscles {
  primary: MuscleKey[];
  secondary: MuscleKey[];
}
