"use client";

import { useState } from "react";

import { formatGrams } from "@/features/foods/utils/food-math";
import { MEAL_PLAN_LIMITS } from "@/features/meal-plans/constants/meal-plans";
import { parseDecimal } from "@/utils/decimal";

// An amount the PT types: saved when the field loses focus and the value is a
// valid, changed number; otherwise the field goes back to the saved grams.
export const useGramsInput = (
  savedGrams: number,
  save: (grams: number) => void,
) => {
  const [text, setText] = useState(formatGrams(savedGrams));

  const handleBlur = () => {
    const grams = parseDecimal(text);
    const isValid =
      Number.isFinite(grams) &&
      grams >= 0 &&
      grams <= MEAL_PLAN_LIMITS.MAX_GRAMS;

    if (!isValid) {
      setText(formatGrams(savedGrams));
      return;
    }
    if (grams !== savedGrams) {
      save(grams);
    }
  };

  return { text, setText, handleBlur };
};
