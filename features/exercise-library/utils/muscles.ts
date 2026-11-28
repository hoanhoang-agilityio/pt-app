import {
  CATALOG_MUSCLE_NAMES,
  MUSCLE_KEYS,
  type MuscleKey,
} from "@/features/exercise-library/constants/muscles";

const KEY_SET: ReadonlySet<string> = new Set(MUSCLE_KEYS);

export const isMuscleKey = (value: unknown): value is MuscleKey =>
  typeof value === "string" && KEY_SET.has(value);

// A free-exercise-db muscle name ("lower back") as our key; null when unknown.
export const fromCatalogMuscle = (name: string): MuscleKey | null => {
  const key = CATALOG_MUSCLE_NAMES[name] ?? name;

  return isMuscleKey(key) ? key : null;
};

// Reads a JSON array column: unknown keys and duplicates are dropped, and a
// broken value reads as no muscles (never throws).
export const parseMuscleColumn = (value: string | null | undefined) => {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");

    return Array.isArray(parsed)
      ? [...new Set(parsed.filter(isMuscleKey))]
      : [];
  } catch {
    return [];
  }
};

// Primary wins: a muscle in both lists is shown as primary only.
export const splitMuscles = (primary: MuscleKey[], secondary: MuscleKey[]) => ({
  primary: [...new Set(primary)],
  secondary: [...new Set(secondary)].filter((key) => !primary.includes(key)),
});
