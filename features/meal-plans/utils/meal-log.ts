import { formatGrams } from "@/features/foods/utils/food-math";
import type { LogNutrition } from "@/features/meal-plans/types/meal-log";
import type { PlanFood } from "@/features/meal-plans/types/meal-plan";
import { kcalOf, macrosOf } from "@/features/meal-plans/utils/plan-totals";

type Per100 = Pick<PlanFood, "protein" | "carbs" | "fat">;

interface TypedNumbers {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

const EMPTY: LogNutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

// A library food: its per-100 g macros scaled to the grams eaten (unrounded),
// kcal following from the macros (4/4/9) like the plan and the targets, so
// eating exactly the plan shows the plan's kcal.
// A free food: what the trainee typed, an empty macro counting as 0 and kcal
// following from the macros (4/4/9) when left empty; null when nothing was
// typed at all.
export const resolveLogNutrition = (
  grams: number,
  food: Per100 | null,
  typed: TypedNumbers,
): LogNutrition | null => {
  if (food) {
    const macros = macrosOf(food, grams);

    return { ...macros, kcal: kcalOf(macros) };
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

// "330 kcal · P 62 · C 0 · F 7,2"
export const formatNutrition = (nutrition: LogNutrition) =>
  `${Math.round(nutrition.kcal)} kcal · P ${formatGrams(nutrition.protein)} · C ${formatGrams(nutrition.carbs)} · F ${formatGrams(nutrition.fat)}`;

// "200 g", or nothing when the amount is unknown.
export const formatLogGrams = (grams: number) =>
  grams > 0 ? `${formatGrams(grams)} g` : "";
