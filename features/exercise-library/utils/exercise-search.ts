import type { MuscleKey } from "@/features/exercise-library/constants/muscles";
import { toNameKey } from "@/utils/name";

export interface Searchable {
  name: string;
  // toNameKey(name), computed once by the caller.
  nameKey: string;
  isCustom: boolean;
  primary: MuscleKey[];
  secondary: MuscleKey[];
}

interface SearchOptions {
  q: string;
  muscle?: MuscleKey;
  limit: number;
}

// Case- and accent-insensitive: "ga ap" finds "Gà áp"; every word of the query
// must appear in the name, in any order. Order: the admin's own exercises
// first, then names that start with the query before names that only contain
// it, then (with a muscle filter) primary before secondary, then A-Z.
export const rankExercises = <T extends Searchable>(
  items: T[],
  { q, muscle, limit }: SearchOptions,
): T[] => {
  const key = toNameKey(q);
  const words = key.split(" ").filter(Boolean);
  const scored: { item: T; prefix: number; secondaryOnly: number }[] = [];

  for (const item of items) {
    const isPrimary = muscle ? item.primary.includes(muscle) : true;

    if (muscle && !isPrimary && !item.secondary.includes(muscle)) {
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
