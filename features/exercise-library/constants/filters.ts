import {
  CATEGORY_KEYS,
  type CategoryKey,
  EQUIPMENT_KEYS,
  type EquipmentKey,
  LEVEL_KEYS,
  type LevelKey,
} from "@/features/exercise-library/constants/labels";
import {
  MUSCLE_KEYS,
  type MuscleKey,
} from "@/features/exercise-library/constants/muscles";

// The search filters: one list of keys per group. Within a group an exercise
// matches any selected key (OR); across groups it must match every group that
// has a selection (AND).
export interface ExerciseFilters {
  muscles: MuscleKey[];
  equipment: EquipmentKey[];
  levels: LevelKey[];
  categories: CategoryKey[];
}

export type FilterGroup = keyof ExerciseFilters;

// Display order of the groups in the filter panel and the active chips.
export const FILTER_GROUPS = [
  "muscles",
  "equipment",
  "levels",
  "categories",
] as const satisfies readonly FilterGroup[];

export const FILTER_OPTIONS: { [G in FilterGroup]: readonly string[] } = {
  muscles: MUSCLE_KEYS,
  equipment: EQUIPMENT_KEYS,
  levels: LEVEL_KEYS,
  categories: CATEGORY_KEYS,
};

export const EMPTY_FILTERS: ExerciseFilters = {
  muscles: [],
  equipment: [],
  levels: [],
  categories: [],
};

// Only built-in exercises have a level and a category: a custom exercise never
// matches them, so the "mine" list does not offer them.
export const CATALOG_ONLY_GROUPS: readonly FilterGroup[] = [
  "levels",
  "categories",
];
