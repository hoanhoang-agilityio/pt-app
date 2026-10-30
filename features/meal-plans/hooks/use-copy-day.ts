"use client";

import { useState } from "react";

import { useMealPlanAction } from "@/features/meal-plans/hooks/use-meal-plan-action";
import { copyDayAction } from "@/features/meal-plans/services/meal-plan-actions";

// "Sao chép sang ngày khác": which dates are ticked and the copy itself.
export const useCopyDay = (
  userId: number,
  dayId: number,
  onDone: () => void,
) => {
  const [selected, setSelected] = useState<string[]>([]);
  const { isPending, run } = useMealPlanAction();

  const toggle = (date: string) => {
    setSelected((previous) =>
      previous.includes(date)
        ? previous.filter((item) => item !== date)
        : [...previous, date],
    );
  };

  const submit = () => {
    run(() => copyDayAction({ userId, dayId, dates: selected }), {
      successMessage: (result) =>
        "copied" in result ? `Đã sao chép sang ${result.copied} ngày` : "",
      onSuccess: () => {
        setSelected([]);
        onDone();
      },
    });
  };

  return { selected, toggle, submit, isPending };
};
