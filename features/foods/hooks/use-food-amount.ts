"use client";

import { useState } from "react";

import { FOOD_LIMITS } from "@/features/foods/constants/foods";
import type { Food } from "@/features/foods/types/food";
import { scaleFood, servingsToGrams } from "@/features/foods/utils/food-math";

export type AmountUnit = "grams" | "servings";

const DEFAULT_AMOUNT: Record<AmountUnit, string> = {
  grams: "100",
  servings: "1",
};

// Accepts "1,5" as well as "1.5".
const parseAmount = (text: string) =>
  text.trim() === "" ? Number.NaN : Number(text.replace(",", "."));

export const useFoodAmount = (
  food: Pick<Food, "kcal" | "protein" | "carbs" | "fat" | "servingGrams">,
) => {
  const [unit, setUnit] = useState<AmountUnit>("grams");
  const [text, setText] = useState(DEFAULT_AMOUNT.grams);

  const amount = parseAmount(text);
  const grams =
    unit === "servings" && food.servingGrams
      ? servingsToGrams(amount, food.servingGrams)
      : amount;
  const isValid =
    Number.isFinite(grams) &&
    grams >= 0 &&
    grams <= FOOD_LIMITS.MAX_AMOUNT_GRAMS;

  const changeUnit = (next: AmountUnit) => {
    setUnit(next);
    setText(DEFAULT_AMOUNT[next]);
  };

  return {
    unit,
    changeUnit,
    text,
    setText,
    isValid,
    // An invalid amount shows zeros and a hint instead of wrong numbers.
    result: scaleFood(food, isValid ? grams : 0),
  };
};
