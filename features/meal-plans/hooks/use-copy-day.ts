"use client";

import { useState } from "react";

import { useMealPlanAction } from "@/features/meal-plans/hooks/use-meal-plan-action";
import { copyDayAction } from "@/features/meal-plans/services/meal-plan-actions";
import { getOverwriteDates } from "@/features/meal-plans/utils/overwrite-message";

// "Sao chép sang ngày khác": which dates are ticked and the copy itself.
export const useCopyDay = (
  userId: number,
  dayId: number,
  datesWithPlan: string[],
  onDone: () => void,
) => {
  const [selected, setSelected] = useState<string[]>([]);
  // True while the "Ghi đè" question is shown instead of the date list.
  const [isConfirming, setIsConfirming] = useState(false);
  const { isPending, run } = useMealPlanAction();

  const overwriteDates = getOverwriteDates(selected, datesWithPlan);

  const toggle = (date: string) => {
    setSelected((previous) =>
      previous.includes(date)
        ? previous.filter((item) => item !== date)
        : [...previous, date],
    );
  };

  const copy = () => {
    setIsConfirming(false);
    run(() => copyDayAction({ userId, dayId, dates: selected }), {
      successMessage: (result) =>
        "copied" in result ? `Đã sao chép sang ${result.copied} ngày` : "",
      onSuccess: () => {
        setSelected([]);
        onDone();
      },
    });
  };

  // Asks first only when a chosen day would lose its plan.
  const submit = () => {
    if (overwriteDates.length) {
      setIsConfirming(true);
      return;
    }
    copy();
  };

  return {
    selected,
    toggle,
    submit,
    confirm: copy,
    cancel: () => setIsConfirming(false),
    isConfirming,
    overwriteDates,
    isPending,
  };
};
