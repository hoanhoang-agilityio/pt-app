"use client";

import { Utensils } from "lucide-react";

import { SubmitButton } from "@/components/common/SubmitButton";
import {
  BUTTON_PRIMARY,
  CARD,
  FIELD_ERROR,
  INPUT,
  LABEL,
  TEXTAREA,
} from "@/constants/styles";
import {
  MEAL_COUNT_LIMITS,
  MEAL_PLAN_LIMITS,
} from "@/features/meal-plans/constants/meal-plans";
import { useMealPreferencesForm } from "@/features/meal-plans/hooks/use-meal-preferences-form";

interface MealPreferencesFormProps {
  preferredMealCount: number | null;
  foodNote: string | null;
}

const COUNTS = Array.from(
  { length: MEAL_COUNT_LIMITS.max - MEAL_COUNT_LIMITS.min + 1 },
  (_, index) => MEAL_COUNT_LIMITS.min + index,
);

// Q1: the trainee tells the PT how many meals they want and what they like
// or avoid.
export const MealPreferencesForm = ({
  preferredMealCount,
  foodNote,
}: MealPreferencesFormProps) => {
  const { formAction, fieldErrors, values } = useMealPreferencesForm();

  return (
    <section className={`${CARD} p-4`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Utensils className="size-4" aria-hidden />
        Yêu cầu bữa ăn
      </p>
      <form action={formAction} className="mt-3 space-y-4">
        <div>
          <label htmlFor="meal-count" className={LABEL}>
            Số bữa mong muốn
          </label>
          <select
            id="meal-count"
            name="mealCount"
            defaultValue={values?.mealCount ?? String(preferredMealCount ?? "")}
            aria-invalid={Boolean(fieldErrors.mealCount)}
            className={INPUT}
          >
            <option value="">PT quyết định</option>
            {COUNTS.map((count) => (
              <option key={count} value={count}>
                {count} bữa/ngày
              </option>
            ))}
          </select>
          {fieldErrors.mealCount && (
            <p className={FIELD_ERROR}>{fieldErrors.mealCount}</p>
          )}
        </div>
        <div>
          <label htmlFor="food-note" className={LABEL}>
            Món thích hoặc không ăn được
          </label>
          <textarea
            id="food-note"
            name="foodNote"
            defaultValue={values?.foodNote ?? foodNote ?? ""}
            rows={3}
            maxLength={MEAL_PLAN_LIMITS.FOOD_NOTE}
            placeholder="VD: Không ăn hải sản, thích cơm gạo lứt."
            aria-invalid={Boolean(fieldErrors.foodNote)}
            className={TEXTAREA}
          />
          {fieldErrors.foodNote && (
            <p className={FIELD_ERROR}>{fieldErrors.foodNote}</p>
          )}
        </div>
        <SubmitButton className={`${BUTTON_PRIMARY} w-full`}>
          Lưu yêu cầu
        </SubmitButton>
      </form>
      <p className="mt-3 text-xs text-muted">
        PT sẽ xem yêu cầu này khi xếp bữa ăn cho bạn.
      </p>
    </section>
  );
};
