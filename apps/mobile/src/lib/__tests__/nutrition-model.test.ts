import { describe, expect, it } from "vitest";

import {
  buildMealView,
  compareToTarget,
  formatGrams,
  formatNutrition,
  listMealNutrition,
  localizeFoodName,
  parseOptionalNumber,
  ringPercent,
  scaleFood,
  servingsToGrams,
  splitDayTarget,
  sumLogNutrition,
} from "../nutrition-model";

const chicken = { carbs: 0, protein: 31, fat: 3.6 };

describe("meal counting", () => {
  it("counts only logs when the meal is not marked", () => {
    const parts = listMealNutrition(
      [{ foodId: 1, grams: 200, food: chicken }],
      [{ foodId: 9, nutrition: { kcal: 100, protein: 5, carbs: 10, fat: 1 } }],
      false,
    );

    expect(parts).toHaveLength(1);
    expect(sumLogNutrition(parts).kcal).toBe(100);
  });
  it("counts the plan when marked, except foods logged instead", () => {
    const logged = { kcal: 50, protein: 10, carbs: 0, fat: 1 };
    const parts = listMealNutrition(
      [
        { foodId: 1, grams: 200, food: chicken },
        { foodId: 2, grams: 100, food: { carbs: 28, protein: 2.7, fat: 0.3 } },
      ],
      [{ foodId: 1, nutrition: logged }],
      true,
    );

    // rice from the plan (food 2) + the logged chicken
    expect(parts).toHaveLength(2);
    expect(parts[1]).toEqual(logged);
    expect(parts[0]?.carbs).toBeCloseTo(28);
  });
  it("prefers frozen numbers over the live plan", () => {
    const frozen = { kcal: 7, protein: 1, carbs: 1, fat: 0 };
    const parts = listMealNutrition(
      [{ foodId: 1, grams: 200, food: chicken }],
      [],
      true,
      [{ foodId: 1, nutrition: frozen }],
    );

    expect(parts).toEqual([frozen]);
  });
  it("counts a food whose row is gone as nothing", () => {
    expect(
      sumLogNutrition(
        listMealNutrition([{ foodId: 1, grams: 100, food: null }], [], true),
      ).kcal,
    ).toBe(0);
  });
  it("builds a meal view from the day's logs and marks", () => {
    const view = buildMealView(
      {
        id: 5,
        position: 0,
        name: "Bữa sáng",
        sharePercent: null,
        items: [
          {
            id: 1,
            foodId: 1,
            grams: 100,
            food: {
              id: 1,
              name: "Gà",
              nameKey: "ga",
              nameEn: null,
              nameZh: null,
              group: "meat",
              state: "cooked",
              kcal: 150,
              protein: 31,
              carbs: 0,
              fat: 3.6,
              isArchived: false,
            },
          },
        ],
      },
      [],
      [{ mealId: 5, achieved: true, note: "", frozen: [] }],
    );

    expect(view.eatenCount).toBe(1);
    expect(view.eaten.protein).toBeCloseTo(31);
    expect(view.planned.protein).toBeCloseTo(31);
  });
});

describe("compareToTarget", () => {
  it("has no judgement without a target", () => {
    expect(compareToTarget(100, undefined, "kcal").status).toBe("none");
    expect(compareToTarget(100, 0, "protein").status).toBe("none");
  });
  it("applies the per-metric tolerance", () => {
    expect(compareToTarget(1950, 2000, "kcal").status).toBe("on");
    expect(compareToTarget(1900, 2000, "kcal").status).toBe("under");
    expect(compareToTarget(2100, 2000, "kcal").status).toBe("over");
  });
  it("never calls extra protein too much", () => {
    expect(compareToTarget(300, 150, "protein").status).toBe("on");
    expect(compareToTarget(100, 150, "protein").status).toBe("under");
  });
});

describe("ringPercent", () => {
  it("clamps and guards bad numbers", () => {
    expect(ringPercent(50, 100)).toBe(50);
    expect(ringPercent(250, 100)).toBe(100);
    expect(ringPercent(10, undefined)).toBe(0);
    expect(ringPercent(Number.NaN, 100)).toBe(0);
    expect(ringPercent(-5, 100)).toBe(0);
  });
});

describe("splitDayTarget", () => {
  it("splits equally with largest remainder", () => {
    const meals = splitDayTarget({ carbs: 100, protein: 100, fat: 100 }, [
      null,
      null,
      null,
    ]);

    expect(meals?.map((meal) => meal.carbs)).toEqual([34, 33, 33]);
  });
  it("uses explicit shares that add up to 100", () => {
    const meals = splitDayTarget({ carbs: 200, protein: 100, fat: 50 }, [
      60,
      40,
    ]);

    expect(meals?.map((meal) => meal.carbs)).toEqual([120, 80]);
  });
  it("rejects mixed, zero and non-100 shares", () => {
    const target = { carbs: 1, protein: 1, fat: 1 };

    expect(splitDayTarget(target, [50, null])).toBeNull();
    expect(splitDayTarget(target, [100, 0])).toBeNull();
    expect(splitDayTarget(target, [50, 40])).toBeNull();
    expect(splitDayTarget(target, [])).toEqual([]);
  });
});

describe("food helpers", () => {
  it("scales per-100g values and rejects bad grams", () => {
    expect(scaleFood({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }, 200)).toEqual({
      kcal: 330,
      protein: 62,
      carbs: 0,
      fat: 7.2,
    });
    expect(scaleFood({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }, -1).kcal).toBe(0);
    expect(servingsToGrams(2, 150)).toBe(300);
    expect(servingsToGrams(Number.NaN, 150)).toBe(0);
  });
  it("localizes names with fallback to the stored one", () => {
    const food = { name: "Ức gà", nameEn: "Chicken breast", nameZh: null };

    expect(localizeFoodName(food, "vi")).toBe("Ức gà");
    expect(localizeFoodName(food, "en")).toBe("Chicken breast");
    expect(localizeFoodName(food, "zh")).toBe("Ức gà");
  });
  it("formats numbers with the Vietnamese comma", () => {
    expect(formatGrams(7.2)).toBe("7,2");
    expect(formatGrams(7.2, "en")).toBe("7.2");
    expect(formatNutrition({ kcal: 330.4, protein: 62, carbs: 0, fat: 7.2 })).toBe(
      "330 kcal · P 62 · C 0 · F 7,2",
    );
  });
  it("parses optional numbers", () => {
    expect(parseOptionalNumber("", 100)).toBeNull();
    expect(parseOptionalNumber("7,5", 100)).toBe(7.5);
    expect(parseOptionalNumber("101", 100)).toBe("invalid");
    expect(parseOptionalNumber("1e2", 1000)).toBe("invalid");
    expect(parseOptionalNumber("-1", 100)).toBe("invalid");
  });
});
