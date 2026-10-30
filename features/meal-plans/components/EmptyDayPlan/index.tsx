"use client";

import { CopyPlus, Plus, UtensilsCrossed } from "lucide-react";

import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD } from "@/constants/styles";
import { useDayPlan } from "@/features/meal-plans/hooks/use-day-plan";

interface EmptyDayPlanProps {
  userId: number;
  date: string;
  weekStart: string;
  // Meals a new plan starts with: the trainee's request, else 3.
  newMealCount: number;
  // Days of last week that have a plan.
  lastWeekPlanCount: number;
}

export const EmptyDayPlan = ({
  userId,
  date,
  weekStart,
  newMealCount,
  lastWeekPlanCount,
}: EmptyDayPlanProps) => {
  const dayPlan = useDayPlan(userId);

  return (
    <div className={`${CARD} space-y-4 p-4`}>
      <div className="flex items-center gap-3 text-sm text-muted">
        <UtensilsCrossed className="size-5 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold text-fg">Chưa có plan</span> cho ngày
          này.
        </p>
      </div>
      <button
        type="button"
        onClick={() => dayPlan.create(date)}
        disabled={dayPlan.isPending}
        className={`${BUTTON_PRIMARY} w-full`}
      >
        <Plus className="size-5" aria-hidden />
        Tạo plan
      </button>
      <p className="-mt-2 text-xs text-muted">
        Plan mới có {newMealCount} bữa, thêm hoặc bớt bữa sau.
      </p>
      <button
        type="button"
        onClick={() => dayPlan.applyLastWeek(weekStart)}
        disabled={dayPlan.isPending || lastWeekPlanCount === 0}
        className={`${BUTTON_SECONDARY} w-full`}
      >
        <CopyPlus className="size-5" aria-hidden />
        Áp dụng tuần trước
      </button>
      <p className="-mt-2 text-xs text-muted">
        {lastWeekPlanCount > 0
          ? `Sao chép ${lastWeekPlanCount} ngày có plan của tuần trước vào các ngày còn trống của tuần này.`
          : "Tuần trước chưa có plan nào."}
      </p>
    </div>
  );
};
