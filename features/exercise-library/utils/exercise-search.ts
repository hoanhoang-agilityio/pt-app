import {
  EMPTY_FILTERS,
  type ExerciseFilters,
} from "@/features/exercise-library/constants/filters";
import type { MuscleKey } from "@/features/exercise-library/constants/muscles";
import { toNameKey } from "@/utils/name";

export interface Searchable {
  name: string;
  // toNameKey(name), computed once by the caller.
  nameKey: string;
  isCustom: boolean;
  primary: MuscleKey[];
  secondary: MuscleKey[];
  // toLabelKey of the equipment, level and category; null when the exercise
  // has none (a custom exercise has no level or category; its free-text
  // equipment is mapped by matchEquipmentKey, null when it reads as no key).
  equipmentKey: string | null;
  levelKey: string | null;
  categoryKey: string | null;
}

interface SearchOptions {
  q: string;
  filters?: ExerciseFilters;
  limit: number;
}

// Within a group any selected key matches; an empty group does not filter. An
// exercise without a value never passes an active group.
const matchesKeys = (selected: readonly string[], value: string | null) =>
  selected.length === 0 || (value !== null && selected.includes(value));

// Case- and accent-insensitive: "ga ap" finds "Gà áp"; every word of the query
// must appear in the name, in any order. Order: the admin's own exercises
// first, then names that start with the query before names that only contain
// it, then (with a muscle filter) primary before secondary, then A-Z. Filters:
// any selected value within a group (OR), every group with a selection (AND).
export const rankExercises = <T extends Searchable>(
  items: T[],
  { q, filters = EMPTY_FILTERS, limit }: SearchOptions,
): T[] => {
  const key = toNameKey(q);
  const words = key.split(" ").filter(Boolean);
  const { muscles } = filters;
  const scored: { item: T; prefix: number; secondaryOnly: number }[] = [];

  for (const item of items) {
    const isPrimary =
      muscles.length === 0 || item.primary.some((key) => muscles.includes(key));

    if (!isPrimary && !item.secondary.some((key) => muscles.includes(key))) {
      continue;
    }
    if (
      !matchesKeys(filters.equipment, item.equipmentKey) ||
      !matchesKeys(filters.levels, item.levelKey) ||
      !matchesKeys(filters.categories, item.categoryKey)
    ) {
      continue;
    }
    if (!words.every((word) => item.nameKey.includes(word))) {
      continue;
    }
    scored.push({
      item,
      prefix: key !== "" && item.nameKey.startsWith(key) ? 0 : 1,
      secondaryOnly: isPrimary ? 0 : 1,
    });
  }
  scored.sort(
    (a, b) =>
      Number(b.item.isCustom) - Number(a.item.isCustom) ||
      a.prefix - b.prefix ||
      a.secondaryOnly - b.secondaryOnly ||
      a.item.nameKey.localeCompare(b.item.nameKey),
  );
  return scored.slice(0, Math.max(0, limit)).map((entry) => entry.item);
};
