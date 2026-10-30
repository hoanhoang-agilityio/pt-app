"use client";

import { useMealPlanAction } from "@/features/meal-plans/hooks/use-meal-plan-action";
import {
  addMealAction,
  applyLastWeekAction,
  createDayPlanAction,
  deleteDayPlanAction,
  reorderMealsAction,
} from "@/features/meal-plans/services/meal-plan-actions";

// What the PT does to a whole day of a member's plan.
export const useDayPlan = (userId: number) => {
  const { isPending, run } = useMealPlanAction();

  return {
    isPending,
    create: (date: string) =>
      run(() => createDayPlanAction({ userId, date }), {
        successMessage: "Đã tạo plan",
      }),
    applyLastWeek: (weekStart: string) =>
      run(() => applyLastWeekAction({ userId, weekStart }), {
        successMessage: (result) =>
          "copied" in result
            ? result.skipped > 0
              ? `Đã áp dụng ${result.copied} ngày, giữ ${result.skipped} ngày đã có plan`
              : `Đã áp dụng ${result.copied} ngày của tuần trước`
            : "",
      }),
    remove: (dayId: number) =>
      run(() => deleteDayPlanAction({ userId, dayId }), {
        successMessage: "Đã xóa plan của ngày này",
      }),
    addMeal: (dayId: number) => run(() => addMealAction({ userId, dayId })),
    reorder: (dayId: number, mealIds: number[]) =>
      run(() => reorderMealsAction({ userId, dayId, mealIds })),
  };
};
