import clsx from "clsx";
import { CircleAlert, CircleCheck } from "lucide-react";

import { CARD } from "@/constants/styles";
import { MacroChips } from "@/features/meal-plans/components/MacroChips";
import { COMPARED_METRIC_LABELS } from "@/features/meal-plans/constants/meal-plans";
import { checkDayPlan } from "@/features/meal-plans/utils/plan-status";
import { kcalOf } from "@/features/meal-plans/utils/plan-totals";
import type { MacroAmounts } from "@/features/nutrition/types/nutrition";

interface DayPlanSummaryProps {
  totals: MacroAmounts;
  target: MacroAmounts | null;
  hasItems: boolean;
}

// The whole day against the day target, with the S2 + R5 verdict.
export const DayPlanSummary = ({
  totals,
  target,
  hasItems,
}: DayPlanSummaryProps) => {
  const check = checkDayPlan(totals, target, hasItems);
  const problems = check.comparisons
    ? (
        Object.entries(check.comparisons) as [
          keyof typeof COMPARED_METRIC_LABELS,
          { status: string; difference: number },
        ][]
      ).filter(([, { status }]) => status === "under" || status === "over")
    : [];

  return (
    <section className={`${CARD} space-y-3 p-4`} aria-label="Tổng cả ngày">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-fg">Cả ngày</h3>
        <p className="text-sm font-semibold text-fg tabular-nums">
          {Math.round(kcalOf(totals))} kcal
          {target && (
            <span className="font-normal text-muted">
              {" "}
              / {Math.round(kcalOf(target))} kcal
            </span>
          )}
        </p>
      </div>
      <MacroChips totals={totals} target={target} />
      {check.status === "on" && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          Đạt mục tiêu
        </p>
      )}
      {check.status === "off" && (
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            Chưa đạt mục tiêu
          </p>
          <ul className="text-xs text-muted">
            {problems.map(([metric, { status, difference }]) => (
              <li key={metric}>
                {COMPARED_METRIC_LABELS[metric].name}{" "}
                {status === "under" ? "thiếu" : "dư"} {Math.round(difference)}{" "}
                {COMPARED_METRIC_LABELS[metric].unit}
              </li>
            ))}
          </ul>
        </div>
      )}
      {check.status === "no-target" && (
        <p className={clsx("text-xs text-muted")}>
          Chưa có mục tiêu dinh dưỡng cho ngày này.
        </p>
      )}
      {check.status === "empty" && (
        <p className="text-xs text-muted">Thêm món vào các bữa để xem tổng.</p>
      )}
    </section>
  );
};
