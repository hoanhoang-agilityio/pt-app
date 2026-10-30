import { describe, expect, it } from "vitest";

import type { BodyProfile } from "@/features/nutrition/types/nutrition";
import {
  calculateBmr,
  calculateCalories,
  calculateEnergyPlan,
  describeFoodEquivalent,
  formatCalories,
  formatDecimal,
  getAge,
  getBirthYear,
  getGoal,
  getGoalFromAdjustment,
  toBodyProfile,
} from "@/features/nutrition/utils/energy";

const TODAY = "2026-10-05";

const MALE: BodyProfile = {
  sex: "male",
  birthYear: 1996,
  heightCm: 175,
  weightKg: 75,
  activityLevel: "moderate",
  goal: "maintain",
  kcalAdjustment: null,
  proteinPerKg: null,
};

describe("age", () => {
  it("converts between age and birth year", () => {
    expect(getAge(1996, TODAY)).toBe(30);
    expect(getBirthYear(30, TODAY)).toBe(1996);
  });
});

describe("calculateBmr", () => {
  it("uses Mifflin-St Jeor", () => {
    // 10·75 + 6.25·175 − 5·30 + 5 = 1698.75
    expect(calculateBmr(MALE, 30)).toBeCloseTo(1698.75);
    // Same body as a woman: −161 instead of +5.
    expect(calculateBmr({ ...MALE, sex: "female" }, 30)).toBeCloseTo(1532.75);
  });
});

describe("calculateEnergyPlan", () => {
  it("maintains at TDEE", () => {
    const plan = calculateEnergyPlan(MALE, TODAY);

    // 1698.75 × 1.55 = 2633.06
    expect(plan).toMatchObject({
      age: 30,
      bmr: 1700,
      tdee: 2630,
      targetCalories: 2630,
    });
    // Protein 75 × 1.8 = 135 g; fat 25% of 2633 / 9 ≈ 73 → 75 g;
    // carbs (2633 − 540 − 675) / 4 ≈ 354 → 355 g.
    expect(plan.macros).toEqual({ carbs: 355, protein: 135, fat: 75 });
  });

  it("cuts 20% and raises protein", () => {
    const plan = calculateEnergyPlan({ ...MALE, goal: "cut" }, TODAY);

    expect(plan.targetCalories).toBe(2110);
    expect(plan.macros.protein).toBe(165);
    // Macros add up to the target within rounding.
    expect(
      Math.abs(calculateCalories(plan.macros) - plan.targetCalories),
    ).toBeLessThan(40);
  });

  it("never returns negative carbs", () => {
    const plan = calculateEnergyPlan(
      {
        ...MALE,
        weightKg: 200,
        heightCm: 120,
        activityLevel: "sedentary",
        goal: "cut",
      },
      TODAY,
    );

    expect(plan.macros.carbs).toBeGreaterThanOrEqual(0);
  });
});

describe("energy model (kcal adjustment + protein per kg)", () => {
  // TDEE 2633.06; protein 75 × 2 = 150 g.
  it("target is TDEE plus the adjustment", () => {
    const cut = calculateEnergyPlan(
      { ...MALE, kcalAdjustment: -200, proteinPerKg: 2 },
      TODAY,
    );

    // 2633.06 − 200 = 2433.06 → 2430; fat 25% / 9 = 67.6 → 70 g;
    // carbs (2433.06 − 600 − 630) / 4 = 300.8 → 300 g.
    expect(cut).toMatchObject({ tdee: 2630, targetCalories: 2430 });
    expect(cut.macros).toEqual({ carbs: 300, protein: 150, fat: 70 });

    const bulk = calculateEnergyPlan(
      { ...MALE, kcalAdjustment: 300, proteinPerKg: 2 },
      TODAY,
    );

    // 2933.06 → 2930; fat 81.5 → 80 g; carbs (2933.06 − 600 − 720) / 4 = 403.3.
    expect(bulk.targetCalories).toBe(2930);
    expect(bulk.macros).toEqual({ carbs: 405, protein: 150, fat: 80 });
  });

  it("zero adjustment maintains and ignores the stored goal", () => {
    const plan = calculateEnergyPlan(
      { ...MALE, goal: "bulk", kcalAdjustment: 0, proteinPerKg: 1.6 },
      TODAY,
    );

    expect(plan.targetCalories).toBe(2630);
    // 75 × 1.6 = 120 g protein; fat 73 → 75 g; carbs (2633.06 − 480 − 675) / 4.
    expect(plan.macros).toEqual({ carbs: 370, protein: 120, fat: 75 });
  });

  it("falls back to the legacy goal values while the fields are null", () => {
    const plan = calculateEnergyPlan({ ...MALE, goal: "cut" }, TODAY);

    expect(plan.targetCalories).toBe(2110);
    expect(plan.macros.protein).toBe(165);
  });

  it("each field falls back on its own", () => {
    const plan = calculateEnergyPlan({ ...MALE, proteinPerKg: 2 }, TODAY);

    expect(plan.targetCalories).toBe(2630);
    expect(plan.macros.protein).toBe(150);
  });

  it("derives the goal from the sign of the adjustment", () => {
    expect(getGoalFromAdjustment(-1)).toBe("cut");
    expect(getGoalFromAdjustment(0)).toBe("maintain");
    expect(getGoalFromAdjustment(1)).toBe("bulk");
    expect(getGoal({ ...MALE, goal: "bulk", kcalAdjustment: -200 })).toBe(
      "cut",
    );
    expect(getGoal({ ...MALE, goal: "bulk" })).toBe("bulk");
  });
});

describe("formatting", () => {
  it("describes food equivalents and calories", () => {
    expect(describeFoodEquivalent("carbs", 280)).toBe("≈ 10 lạng cơm chín");
    expect(describeFoodEquivalent("protein", 135)).toBe(
      "≈ 4,4 lạng ức gà chín",
    );
    expect(describeFoodEquivalent("fat", 56)).toBe("≈ 4 thìa dầu ăn");
    expect(formatCalories(2630)).toBe("2.630 kcal");
    expect(formatDecimal(72.5)).toBe("72,5");
    expect(formatDecimal(1750)).toBe("1750");
  });
});

describe("toBodyProfile", () => {
  const draft = {
    sex: "male" as const,
    age: "30",
    heightCm: "175",
    weightKg: "72,5",
    activityLevel: "moderate" as const,
    goal: "cut" as const,
    kcalAdjustment: "-200",
    proteinPerKg: "1,6",
  };

  it("parses decimal commas and derives the birth year", () => {
    expect(toBodyProfile(draft, TODAY)).toMatchObject({
      birthYear: 1996,
      weightKg: 72.5,
      kcalAdjustment: -200,
      proteinPerKg: 1.6,
    });
  });

  it("reads an empty energy model as not set", () => {
    expect(
      toBodyProfile({ ...draft, kcalAdjustment: "", proteinPerKg: "" }, TODAY),
    ).toMatchObject({ kcalAdjustment: null, proteinPerKg: null });
  });

  it("accepts signs and the bounds, rejects values outside", () => {
    const adjust = (kcalAdjustment: string) =>
      toBodyProfile({ ...draft, kcalAdjustment }, TODAY)?.kcalAdjustment;
    const protein = (proteinPerKg: string) =>
      toBodyProfile({ ...draft, proteinPerKg }, TODAY)?.proteinPerKg;

    expect(adjust("+300")).toBe(300);
    expect(adjust("−1000")).toBe(-1000);
    expect(adjust("1000")).toBe(1000);
    expect(adjust("1001")).toBeUndefined();
    expect(adjust("-1001")).toBeUndefined();
    expect(adjust("-200,5")).toBeUndefined();
    expect(protein("1")).toBe(1);
    expect(protein("3")).toBe(3);
    expect(protein("0,9")).toBeUndefined();
    expect(protein("3,1")).toBeUndefined();
  });

  it("returns null for incomplete or implausible numbers", () => {
    expect(toBodyProfile({ ...draft, weightKg: "" }, TODAY)).toBeNull();
    expect(toBodyProfile({ ...draft, heightCm: "17" }, TODAY)).toBeNull();
    expect(toBodyProfile({ ...draft, age: "30.5" }, TODAY)).toBeNull();
  });
});
