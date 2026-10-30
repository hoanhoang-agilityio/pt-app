import { describe, expect, it } from "vitest";

import type {
  FoodEntry,
  NutritionDay,
  NutritionTarget,
} from "@/features/nutrition/types/nutrition";
import {
  buildNutritionDay,
  compareToTarget,
  findTargetForDate,
  isDayOnTarget,
  sumEntries,
  summarizeNutritionWeek,
} from "@/features/nutrition/utils/nutrition";

const TARGET: NutritionTarget = {
  effectiveFrom: "2026-10-01",
  carbs: 200,
  protein: 150,
  fat: 50,
  note: "",
  source: "manual",
};

const createEntry = (
  carbs: number | null,
  protein: number | null,
  fat: number | null,
): FoodEntry => ({
  id: 1,
  date: "2026-10-05",
  meal: "lunch",
  description: "",
  carbs,
  protein,
  fat,
});

const createDay = (
  date: string,
  entries: FoodEntry[],
  target = TARGET,
): NutritionDay => buildNutritionDay(date, target, entries, []);

describe("buildNutritionDay", () => {
  const target = TARGET;

  it("adds the meal logs to the old entries and rounds to whole grams", () => {
    // Entry: C 100 / P 20 / F 10. Logs: 200 g chicken (P 62, F 7.2) and
    // 300 g rice (P 8.1, C 84.6, F 0.9).
    const day = buildNutritionDay(
      "2026-10-05",
      target,
      [createEntry(100, 20, 10)],
      [
        { carbs: 0, protein: 62, fat: 7.2 },
        { carbs: 84.6, protein: 8.1, fat: 0.9 },
      ],
    );

    // C 184.6 -> 185, P 90.1 -> 90, F 18.1 -> 18.
    expect(day.totals).toEqual({ carbs: 185, protein: 90, fat: 18 });
    expect(day.loggedCount).toBe(3);
  });

  it("counts a day with only meal logs as logged and on target when it fits", () => {
    const day = buildNutritionDay(
      "2026-10-05",
      target,
      [],
      [{ carbs: TARGET.carbs, protein: TARGET.protein, fat: TARGET.fat }],
    );

    expect(day.loggedCount).toBe(1);
    expect(day.entries).toEqual([]);
    expect(isDayOnTarget(day)).toBe(true);
  });

  it("is not logged with nothing", () => {
    const day = buildNutritionDay("2026-10-05", target, [], []);

    expect(day.loggedCount).toBe(0);
    expect(isDayOnTarget(day)).toBe(false);
  });
});

describe("sumEntries", () => {
  it("treats missing macros as zero", () => {
    expect(
      sumEntries([createEntry(100, null, 10), createEntry(50, 80, null)]),
    ).toEqual({
      carbs: 150,
      protein: 80,
      fat: 10,
    });
  });
});

describe("findTargetForDate", () => {
  const later = { ...TARGET, effectiveFrom: "2026-10-08", carbs: 180 };

  it("uses the latest target that already started", () => {
    expect(findTargetForDate([TARGET, later], "2026-10-05")).toBe(TARGET);
    expect(findTargetForDate([TARGET, later], "2026-10-08")).toBe(later);
    expect(findTargetForDate([TARGET, later], "2026-09-30")).toBeNull();
  });
});

describe("compareToTarget", () => {
  it.each([
    // carbs and fat: ±10 g
    ["carbs", 100, 200, "under", 100],
    ["carbs", 190, 200, "on", 10],
    ["carbs", 189, 200, "under", 11],
    ["carbs", 210, 200, "on", 10],
    ["carbs", 211, 200, "over", 11],
    ["fat", 41, 50, "on", 9],
    ["fat", 61, 50, "over", 11],
    // protein: at most 5 g under, any amount over
    ["protein", 145, 150, "on", 5],
    ["protein", 144, 150, "under", 6],
    ["protein", 210, 150, "on", 60],
    // kcal: ±80
    ["kcal", 2420, 2500, "on", 80],
    ["kcal", 2419, 2500, "under", 81],
    ["kcal", 2580, 2500, "on", 80],
    ["kcal", 2581, 2500, "over", 81],
  ] as const)(
    "%s %s of a %s target is %s",
    (metric, actual, target, status, difference) => {
      expect(compareToTarget(actual, target, metric)).toMatchObject({
        status,
        difference,
      });
    },
  );

  it("reports no target", () => {
    expect(compareToTarget(100, 0, "carbs").status).toBe("none");
    expect(compareToTarget(100, undefined, "kcal").status).toBe("none");
  });
});

describe("week summary", () => {
  const onTarget = createDay("2026-10-05", [createEntry(200, 150, 50)]);
  const under = createDay("2026-10-06", [createEntry(100, 60, 20)]);
  const empty = createDay("2026-10-07", []);

  it("checks whether a day hit every target", () => {
    expect(isDayOnTarget(onTarget)).toBe(true);
    expect(isDayOnTarget(under)).toBe(false);
    expect(isDayOnTarget(empty)).toBe(false);
  });

  it("applies the kcal, protein and carbs/fat rules together", () => {
    // Target 200/150/50 = 800 + 600 + 450 = 1850 kcal.
    const day = (carbs: number, protein: number, fat: number) =>
      isDayOnTarget(
        createDay("2026-10-05", [createEntry(carbs, protein, fat)]),
      );

    // Each macro on its edge: 210/145/40 = 840 + 580 + 360 = 1780, 70 under.
    expect(day(210, 145, 40)).toBe(true);
    // Carbs 11 g over.
    expect(day(211, 150, 50)).toBe(false);
    // Protein 6 g under.
    expect(day(200, 144, 50)).toBe(false);
    // Protein far over is fine for protein, but kcal 2300 − 1850 = +450.
    expect(day(200, 260, 50)).toBe(false);
    // Macros each inside, kcal outside: 210/150/60 = 840 + 600 + 540 = 1980.
    expect(day(210, 150, 60)).toBe(false);
    // Fat 10 over alone (60) is a fat pass but kcal 1940 is 90 over.
    expect(day(200, 150, 60)).toBe(false);
  });

  it("averages over logged days only", () => {
    expect(summarizeNutritionWeek([onTarget, under, empty])).toEqual({
      loggedDays: 2,
      averages: { carbs: 150, protein: 105, fat: 35 },
      onTargetDays: 1,
    });
  });
});
