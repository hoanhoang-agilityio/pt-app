import { MEAL_PLAN_LIMITS } from "@/features/meal-plans/constants/meal-plans";
import { parseDecimal } from "@/utils/decimal";

// What the server stores for a typed amount (one decimal), or null when the
// text is not an amount from 0 to MAX_GRAMS.
export const normalizeGrams = (text: string) => {
  const parsed = parseDecimal(text);
  const grams = Math.round(parsed * 10) / 10;

  return Number.isFinite(grams) &&
    grams >= 0 &&
    grams <= MEAL_PLAN_LIMITS.MAX_GRAMS
    ? grams
    : null;
};
