import type { LogNutrition } from "@/features/meal-plans/types/meal-log";
import type { PlanFood } from "@/features/meal-plans/types/meal-plan";
import { kcalOf } from "@/features/meal-plans/utils/plan-totals";

type Per100 = Pick<PlanFood, "kcal" | "protein" | "carbs" | "fat">;

interface TypedNumbers {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

const EMPTY: LogNutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

// A library food: its per-100 g numbers scaled to the grams eaten (unrounded).
// A free food: what the trainee typed, an empty macro counting as 0 and kcal
// following from the macros (4/4/9) when left empty; null when nothing was
// typed at all.
export const resolveLogNutrition = (
  grams: number,
  food: Per100 | null,
  typed: TypedNumbers,
): LogNutrition | null => {
  if (food) {
    const factor = grams / 100;

    return {
      kcal: food.kcal * factor,
      protein: food.protein * factor,
      carbs: food.carbs * factor,
      fat: food.fat * factor,
    };
  }
  if (Object.values(typed).every((value) => value === null)) {
    return null;
  }

  const macros = {
    protein: typed.protein ?? 0,
    carbs: typed.carbs ?? 0,
    fat: typed.fat ?? 0,
  };

  return { ...macros, kcal: typed.kcal ?? kcalOf(macros) };
};

export const sumLogNutrition = (parts: (LogNutrition | null)[]): LogNutrition =>
  parts.reduce<LogNutrition>(
    (sum, part) =>
      part
        ? {
            kcal: sum.kcal + part.kcal,
            protein: sum.protein + part.protein,
            carbs: sum.carbs + part.carbs,
            fat: sum.fat + part.fat,
          }
        : sum,
    EMPTY,
  );

const round1 = (value: number) =>
  (Math.round(value * 10) / 10).toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
    useGrouping: false,
  });

// "330 kcal · P 62 · C 0 · F 7,2"
export const formatNutrition = (nutrition: LogNutrition) =>
  `${Math.round(nutrition.kcal)} kcal · P ${round1(nutrition.protein)} · C ${round1(nutrition.carbs)} · F ${round1(nutrition.fat)}`;

// "200 g", or nothing when the amount is unknown.
export const formatLogGrams = (grams: number) =>
  grams > 0 ? `${round1(grams)} g` : "";
