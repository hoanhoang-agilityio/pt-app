import { describe, expect, it } from "vitest";

import {
  resolveLogNutrition,
  sumLogNutrition,
} from "@/features/meal-plans/utils/meal-log";

const NONE = { kcal: null, protein: null, carbs: null, fat: null };
const CHICKEN = { kcal: 165, protein: 31, carbs: 0, fat: 3.6 };

describe("resolveLogNutrition", () => {
  it("scales a library food by grams", () => {
    // 200 g of chicken: 330 kcal, 62 g protein, 7.2 g fat.
    expect(resolveLogNutrition(200, CHICKEN, NONE)).toEqual({
      kcal: 330,
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

describe("sumLogNutrition", () => {
  it("adds the foods and ignores those without numbers", () => {
    expect(
      sumLogNutrition([
        { kcal: 330, protein: 62, carbs: 0, fat: 7.2 },
        null,
        { kcal: 370, protein: 20, carbs: 50, fat: 10 },
      ]),
    ).toEqual({ kcal: 700, protein: 82, carbs: 50, fat: 17.2 });
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
