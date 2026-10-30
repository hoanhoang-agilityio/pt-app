import { describe, expect, it } from "vitest";

import {
  formatLogGrams,
  formatNutrition,
  resolveLogNutrition,
  sumLogNutrition,
} from "@/features/meal-plans/utils/meal-log";
import {
  kcalOf,
  macrosOf,
  sumMacros,
} from "@/features/meal-plans/utils/plan-totals";

const NONE = { kcal: null, protein: null, carbs: null, fat: null };
const CHICKEN = { kcal: 165, protein: 31, carbs: 0, fat: 3.6 };

describe("resolveLogNutrition", () => {
  it("scales a library food by grams", () => {
    // 200 g of chicken: P 62, F 7.2 -> 4/4/9 = 248 + 64.8 = 312.8 kcal (the
    // library's own 165 kcal/100 g is not used, like everywhere else).
    expect(resolveLogNutrition(200, CHICKEN, NONE)).toEqual({
      kcal: 312.8,
      protein: 62,
      carbs: 0,
      fat: 7.2,
    });
  });

  it("uses what was typed for a free food and counts a blank macro as 0", () => {
    expect(
      resolveLogNutrition(0, null, { ...NONE, kcal: 450, protein: 20 }),
    ).toEqual({ kcal: 450, protein: 20, carbs: 0, fat: 0 });
  });

  it("derives kcal from the macros (4/4/9) when kcal is blank", () => {
    // 20 g P + 50 g C + 10 g F = 80 + 200 + 90 = 370 kcal.
    expect(
      resolveLogNutrition(0, null, {
        ...NONE,
        protein: 20,
        carbs: 50,
        fat: 10,
      }),
    ).toEqual({ kcal: 370, protein: 20, carbs: 50, fat: 10 });
  });

  it("is null when a free food has no numbers", () => {
    expect(resolveLogNutrition(150, null, NONE)).toBeNull();
  });
});

describe("eating exactly the plan", () => {
  it("gives the same kcal as the plan", () => {
    // Plan: 200 g chicken + 300 g rice. The plan side is kcalOf(sumItems).
    const rice = { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 };
    const planned = kcalOf(
      sumMacros([macrosOf(CHICKEN, 200), macrosOf(rice, 300)]),
    );
    const eaten = sumLogNutrition([
      resolveLogNutrition(200, CHICKEN, NONE),
      resolveLogNutrition(300, rice, NONE),
    ]);

    // P 70.1, C 84.6, F 8.1 -> 280.4 + 338.4 + 72.9 = 691.7 kcal.
    expect(planned).toBeCloseTo(691.7, 6);
    expect(eaten.kcal).toBeCloseTo(planned, 6);
  });
});

describe("sumLogNutrition", () => {
  it("adds the foods and ignores those without numbers", () => {
    expect(
      sumLogNutrition([
        { kcal: 312.8, protein: 62, carbs: 0, fat: 7.2 },
        null,
        { kcal: 370, protein: 20, carbs: 50, fat: 10 },
      ]),
    ).toEqual({ kcal: 682.8, protein: 82, carbs: 50, fat: 17.2 });
  });

  it("is all zero for nothing logged", () => {
    expect(sumLogNutrition([])).toEqual({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe("formatNutrition", () => {
  it("rounds kcal and shows one decimal with a comma", () => {
    expect(
      formatNutrition({ kcal: 329.6, protein: 62, carbs: 0, fat: 7.24 }),
    ).toBe("330 kcal · P 62 · C 0 · F 7,2");
  });
});

describe("formatLogGrams", () => {
  it("is empty for an unknown amount", () => {
    expect(formatLogGrams(0)).toBe("");
    expect(formatLogGrams(200)).toBe("200 g");
    expect(formatLogGrams(62.5)).toBe("62,5 g");
  });
});
