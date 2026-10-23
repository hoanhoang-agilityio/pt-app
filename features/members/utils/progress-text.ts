import type { ExerciseProgressRow } from "@/features/members/types/progress";
import { formatWeightChange } from "@/features/nutrition/utils/weight";
import { formatSet } from "@/features/workouts/utils/set-logger";

export type TrendTone = "neutral" | "up" | "down";

export interface TrendBadge {
  label: string;
  tone: TrendTone;
}

// Badge text for a "Tiến bộ" row (KAN-34): "Lần đầu", "+2,5 kg", "−2,5 kg",
// "Cùng mức, thêm reps" (same weight, more reps) or "Không đổi".
export const describeTrend = ({
  trend,
  changeKg,
}: Pick<ExerciseProgressRow, "trend" | "changeKg">): TrendBadge => {
  switch (trend) {
    case "first":
      return { label: "Lần đầu", tone: "neutral" };
    case "up":
      return {
        label:
          changeKg === null || changeKg === 0
            ? "Cùng mức, thêm reps"
            : formatWeightChange(changeKg),
        tone: "up",
      };
    case "down":
      return { label: formatWeightChange(changeKg ?? 0), tone: "down" };
    default:
      return { label: "Không đổi", tone: "neutral" };
  }
};

// ["Lần trước 40 kg × 10", "Tuần này 42,5 kg × 8"]; a first session has no
// previous best. Separate lines so a row never breaks inside "kg × reps".
export const describeBests = ({
  weekBest,
  previousBest,
}: Pick<ExerciseProgressRow, "weekBest" | "previousBest">) => {
  const current = `Tuần này ${formatSet(weekBest)}`;

  return previousBest
    ? [`Lần trước ${formatSet(previousBest)}`, current]
    : [current];
};
