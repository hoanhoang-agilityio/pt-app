"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  startTransition,
  useActionState,
  useState,
} from "react";

import { INITIAL_FORM_STATE } from "@/constants/form";
import { ROUTES } from "@/constants/routes";
import {
  createFoodAction,
  updateFoodAction,
} from "@/features/foods/services/food-actions";
import type { Food } from "@/features/foods/types/food";
import {
  describeKcalGap,
  formatKcal,
  isKcalGapTooLarge,
  kcalFromMacros,
} from "@/features/foods/utils/food-math";
import { useFormFeedback } from "@/hooks/use-form-feedback";

// Accepts "3,6" as well as "3.6"; empty or text gives NaN.
const toNumber = (text: string) =>
  text.trim() === "" ? Number.NaN : Number(text.replace(",", "."));

const toText = (value: number | undefined) =>
  value === undefined ? "" : String(value);

export const useFoodForm = (food: Food | null) => {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    food ? updateFoodAction : createFoodAction,
    INITIAL_FORM_STATE,
  );
  const [kcal, setKcal] = useState(toText(food?.kcal));
  const [protein, setProtein] = useState(toText(food?.protein));
  const [carbs, setCarbs] = useState(toText(food?.carbs));
  const [fat, setFat] = useState(toText(food?.fat));
  const [isConfirmed, setIsConfirmed] = useState(false);

  // A new food goes back to the list; an edit stays on the page.
  useFormFeedback(state, () => {
    if (!food) {
      router.push(ROUTES.ADMIN_FOODS);
    }
  });

  const macros = {
    protein: toNumber(protein),
    carbs: toNumber(carbs),
    fat: toNumber(fat),
  };
  const kcalValue = toNumber(kcal);
  const hasAllNumbers = [kcalValue, ...Object.values(macros)].every(
    (value) => Number.isFinite(value) && value >= 0,
  );
  const kcalCheck = hasAllNumbers
    ? {
        fromMacros: formatKcal(kcalFromMacros(macros)),
        isGapTooLarge: isKcalGapTooLarge(kcalValue, macros),
        warning: describeKcalGap(kcalValue, macros),
      }
    : null;

  // Submitted through a transition so React doesn't reset the fields when
  // the server returns validation errors.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(() => formAction(formData));
  };

  return {
    values: { kcal, protein, carbs, fat },
    setKcal,
    setProtein,
    setCarbs,
    setFat,
    isConfirmed,
    setIsConfirmed,
    kcalCheck,
    isPending,
    fieldErrors: state.status === "error" ? (state.fieldErrors ?? {}) : {},
    formError:
      state.status === "error" && !state.fieldErrors
        ? state.message
        : undefined,
    handleSubmit,
  };
};
