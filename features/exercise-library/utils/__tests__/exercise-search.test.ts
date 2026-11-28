import { describe, expect, it } from "vitest";

import {
  rankExercises,
  type Searchable,
} from "@/features/exercise-library/utils/exercise-search";
import { toNameKey } from "@/utils/name";

const make = (
  name: string,
  overrides: Partial<Searchable> = {},
): Searchable => ({
  name,
  nameKey: toNameKey(name),
  isCustom: false,
  primary: [],
  secondary: [],
  ...overrides,
});

const names = (items: Searchable[]) => items.map((item) => item.name);

describe("rankExercises", () => {
  const items = [
    make("Incline Bench Press", { primary: ["chest"] }),
    make("Bench Press", { primary: ["chest"], secondary: ["triceps"] }),
    make("Dumbbell Bench Press", { primary: ["chest"] }),
    make("Barbell Curl", { primary: ["biceps"] }),
    make("Hammer Curl", { primary: ["biceps"], secondary: ["forearms"] }),
    make("Gà áp chảo", { isCustom: true, primary: ["chest"] }),
    make("Bench dips", { isCustom: true, primary: ["triceps"] }),
  ];

  it("ignores case and accents", () => {
    expect(names(rankExercises(items, { q: "GA AP", limit: 30 }))).toEqual([
      "Gà áp chảo",
    ]);
  });

  it("requires every word, in any order", () => {
    expect(
      names(rankExercises(items, { q: "press bench", limit: 30 })),
    ).toEqual(["Bench Press", "Dumbbell Bench Press", "Incline Bench Press"]);
  });

  it("puts custom first, then prefix matches, then substring matches", () => {
    expect(names(rankExercises(items, { q: "bench", limit: 30 }))).toEqual([
      "Bench dips",
      "Bench Press",
      "Dumbbell Bench Press",
      "Incline Bench Press",
    ]);
  });

  it("lists everything A-Z with custom first for an empty query", () => {
    expect(names(rankExercises(items, { q: "  ", limit: 3 }))).toEqual([
      "Bench dips",
      "Gà áp chảo",
      "Barbell Curl",
    ]);
  });

  it("filters by muscle, primary before secondary", () => {
    expect(
      names(rankExercises(items, { q: "", muscle: "forearms", limit: 30 })),
    ).toEqual(["Hammer Curl"]);
    expect(
      names(rankExercises(items, { q: "bench", muscle: "triceps", limit: 30 })),
    ).toEqual(["Bench dips", "Bench Press"]);
  });

  it("applies the limit after ranking", () => {
    expect(names(rankExercises(items, { q: "bench", limit: 2 }))).toEqual([
      "Bench dips",
      "Bench Press",
    ]);
    expect(rankExercises(items, { q: "bench", limit: 0 })).toEqual([]);
  });

  it("finds nothing for an unknown name", () => {
    expect(rankExercises(items, { q: "zzz", limit: 30 })).toEqual([]);
  });
});
