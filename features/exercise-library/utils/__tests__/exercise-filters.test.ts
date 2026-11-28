import { describe, expect, it } from "vitest";

import {
  EMPTY_FILTERS,
  type ExerciseFilters,
} from "@/features/exercise-library/constants/filters";
import {
  clearedFilters,
  countFilters,
  hasFilters,
  toggleFilterKey,
} from "@/features/exercise-library/utils/exercise-filters";

describe("toggleFilterKey", () => {
  it("adds a key and removes it again", () => {
    const on = toggleFilterKey(EMPTY_FILTERS, "muscles", "chest");

    expect(on).toEqual({ ...EMPTY_FILTERS, muscles: ["chest"] });
    expect(toggleFilterKey(on, "muscles", "chest")).toEqual(EMPTY_FILTERS);
  });

  it("keeps the option-list order whatever the pick order", () => {
    const a = toggleFilterKey(
      toggleFilterKey(EMPTY_FILTERS, "muscles", "triceps"),
      "muscles",
      "abdominals",
    );
    const b = toggleFilterKey(
      toggleFilterKey(EMPTY_FILTERS, "muscles", "abdominals"),
      "muscles",
      "triceps",
    );

    expect(a.muscles).toEqual(["abdominals", "triceps"]);
    expect(b).toEqual(a);
  });

  it("changes only the toggled group and does not mutate", () => {
    const start: ExerciseFilters = { ...EMPTY_FILTERS, levels: ["expert"] };
    const next = toggleFilterKey(start, "equipment", "cable");

    expect(next).toEqual({
      ...EMPTY_FILTERS,
      levels: ["expert"],
      equipment: ["cable"],
    });
    expect(start.equipment).toEqual([]);
  });

  it("returns the same object for a key that is not an option of the group", () => {
    const start: ExerciseFilters = { ...EMPTY_FILTERS, muscles: ["chest"] };

    expect(toggleFilterKey(start, "muscles", "wings")).toBe(start);
    expect(toggleFilterKey(start, "levels", "chest")).toBe(start);
  });
});

describe("countFilters and hasFilters", () => {
  it("counts the keys of every group", () => {
    const filters: ExerciseFilters = {
      muscles: ["chest", "lats"],
      equipment: ["cable"],
      levels: [],
      categories: ["cardio"],
    };

    expect(countFilters(filters)).toBe(4);
    expect(hasFilters(filters)).toBe(true);
    expect(countFilters(EMPTY_FILTERS)).toBe(0);
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
  });
});

describe("clearedFilters", () => {
  it("is empty and a fresh object each time", () => {
    const a = clearedFilters();

    expect(a).toEqual({
      muscles: [],
      equipment: [],
      levels: [],
      categories: [],
    });
    expect(a).not.toBe(EMPTY_FILTERS);
    expect(clearedFilters()).not.toBe(a);
  });
});
