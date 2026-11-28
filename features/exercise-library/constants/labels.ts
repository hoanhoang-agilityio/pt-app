// Values of the catalog fields that have a translation in
// messages/<locale>/exerciseLibrary.json (equipmentNames, levels, categories).
// Anything else (a custom exercise's equipment) is shown as typed.
export const EQUIPMENT_KEYS = [
  "barbell",
  "dumbbell",
  "other",
  "body_only",
  "cable",
  "machine",
  "kettlebells",
  "bands",
  "medicine_ball",
  "exercise_ball",
  "foam_roll",
  "e_z_curl_bar",
] as const;

export const LEVEL_KEYS = ["beginner", "intermediate", "expert"] as const;

export const CATEGORY_KEYS = [
  "strength",
  "stretching",
  "plyometrics",
  "powerlifting",
  "olympic_weightlifting",
  "strongman",
  "cardio",
] as const;

// "body only" -> "body_only", "e-z curl bar" -> "e_z_curl_bar".
export const toLabelKey = (value: string) =>
  value.replace(/[^a-z]+/gi, "_").toLowerCase();

export const isLabelKey = <T extends readonly string[]>(
  keys: T,
  value: string,
): value is T[number] => (keys as readonly string[]).includes(value);

export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];
export type LevelKey = (typeof LEVEL_KEYS)[number];
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
