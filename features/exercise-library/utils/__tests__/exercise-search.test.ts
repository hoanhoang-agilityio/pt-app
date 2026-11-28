import { describe, expect, it } from "vitest";

import { EMPTY_FILTERS } from "@/features/exercise-library/constants/filters";
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
  equipmentKey: null,
  levelKey: null,
  categoryKey: null,
  ...overrides,
});

const names = (items: Searchable[]) => items.map((item) => item.name);

const filtersOf = (filters: Partial<typeof EMPTY_FILTERS>) => ({
  ...EMPTY_FILTERS,
  ...filters,
});

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
      names(
        rankExercises(items, {
          q: "",
          filters: filtersOf({ muscles: ["forearms"] }),
          limit: 30,
        }),
      ),
    ).toEqual(["Hammer Curl"]);
    expect(
      names(
        rankExercises(items, {
          q: "bench",
          filters: filtersOf({ muscles: ["triceps"] }),
          limit: 30,
        }),
      ),
    ).toEqual(["Bench dips", "Bench Press"]);
  });

  it("matches any of several muscles, primary matches before secondary-only", () => {
    expect(
      names(
        rankExercises(items, {
          q: "",
          filters: filtersOf({ muscles: ["biceps", "triceps"] }),
          limit: 30,
        }),
      ),
    ).toEqual(["Bench dips", "Barbell Curl", "Hammer Curl", "Bench Press"]);
    expect(
      names(
        rankExercises(items, {
          q: "",
          filters: filtersOf({ muscles: ["forearms", "triceps"] }),
          limit: 30,
        }),
      ),
    ).toEqual(["Bench dips", "Bench Press", "Hammer Curl"]);
  });

  describe("equipment, level and category", () => {
    const catalog = [
      make("Barbell Squat", {
        equipmentKey: "barbell",
        levelKey: "intermediate",
        categoryKey: "strength",
        primary: ["quadriceps"],
      }),
      make("Push-up", {
        equipmentKey: "body_only",
        levelKey: "beginner",
        categoryKey: "strength",
        primary: ["chest"],
      }),
      make("Hip stretch", {
        equipmentKey: "body_only",
        levelKey: "beginner",
        categoryKey: "stretching",
        primary: ["glutes"],
      }),
      make("Deadlift", {
        equipmentKey: "barbell",
        levelKey: "expert",
        categoryKey: "powerlifting",
        primary: ["glutes"],
      }),
      make("Floor stretch", { equipmentKey: null, levelKey: "beginner" }),
      // Custom: free-text equipment, no level or category.
      make("Squat riêng", {
        isCustom: true,
        equipmentKey: "barbell",
        primary: ["quadriceps"],
      }),
      make("Bài lạ", { isCustom: true, equipmentKey: "ta_don_kem_day" }),
      make("Không dụng cụ", { isCustom: true }),
    ];
    const run = (filters: Partial<typeof EMPTY_FILTERS>) =>
      names(
        rankExercises(catalog, {
          q: "",
          filters: filtersOf(filters),
          limit: 30,
        }),
      );

    it("matches equipment, including a custom exercise's free text", () => {
      expect(run({ equipment: ["barbell"] })).toEqual([
        "Squat riêng",
        "Barbell Squat",
        "Deadlift",
      ]);
      expect(run({ equipment: ["body_only", "barbell"] })).toEqual([
        "Squat riêng",
        "Barbell Squat",
        "Deadlift",
        "Hip stretch",
        "Push-up",
      ]);
    });

    it("leaves out an exercise without equipment while an equipment filter is on", () => {
      expect(run({ equipment: ["cable"] })).toEqual([]);
    });

    it("excludes custom exercises while a level or category filter is on", () => {
      expect(run({ levels: ["beginner", "expert"] })).toEqual([
        "Deadlift",
        "Floor stretch",
        "Hip stretch",
        "Push-up",
      ]);
      expect(run({ categories: ["strength"] })).toEqual([
        "Barbell Squat",
        "Push-up",
      ]);
    });

    it("ANDs the groups and ORs inside one", () => {
      expect(
        run({ equipment: ["body_only"], categories: ["stretching"] }),
      ).toEqual(["Hip stretch"]);
      expect(
        run({
          muscles: ["glutes", "chest"],
          equipment: ["body_only"],
          levels: ["beginner"],
        }),
      ).toEqual(["Hip stretch", "Push-up"]);
      expect(
        run({ muscles: ["quadriceps"], equipment: ["body_only"] }),
      ).toEqual([]);
    });

    it("combines filters with the text query", () => {
      expect(
        names(
          rankExercises(catalog, {
            q: "stretch",
            filters: filtersOf({ levels: ["beginner"] }),
            limit: 30,
          }),
        ),
      ).toEqual(["Floor stretch", "Hip stretch"]);
    });
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
