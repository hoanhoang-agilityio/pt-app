// The 17 muscle groups of free-exercise-db, as stable snake_case keys. One
// source for the Zod schemas, the diagram and the filter chips (labels are in
// messages/<locale>/exerciseLibrary.json under `muscles`).
export const MUSCLE_KEYS = [
  "abdominals",
  "abductors",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower_back",
  "middle_back",
  "neck",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
] as const;

export type MuscleKey = (typeof MUSCLE_KEYS)[number];

// free-exercise-db spells two keys with a space.
export const CATALOG_MUSCLE_NAMES: Record<string, MuscleKey> = {
  "lower back": "lower_back",
  "middle back": "middle_back",
};
