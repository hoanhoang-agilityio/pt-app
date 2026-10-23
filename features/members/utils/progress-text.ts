import type { ExerciseProgressRow } from "@/features/members/types/progress";
import { formatWeightChange } from "@/features/nutrition/utils/weight";
import { formatSet } from "@/features/workouts/utils/set-logger";

export type TrendTone = "neutral" | "up" | "down";

export interface TrendBadge {
  label: string;
  tone: TrendTone;
}

// Badge text for a "Tiến bộ" row (KAN-34): "Lần đầu", "+2,5 kg", "−2,5 kg",
// "Cùng mức, thêm reps" / "Cùng mức, ít reps" (same weight) or "Không đổi".
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
      return {
        label:
          changeKg === null || changeKg === 0
            ? "Cùng mức, ít reps"
            : formatWeightChange(changeKg),
        tone: "down",
      };
    default:
      return { label: "Không đổi", tone: "neutral" };
  }
};

// ["Tốt nhất trước đó 40 kg × 10", "Tốt nhất tuần này 42,5 kg × 8"]; the
// previous figure is the best of all earlier weeks (F4), not last session. A
// first session has no previous best. Separate lines so a row never breaks inside "kg × reps".
export const describeBests = ({
  weekBest,
  previousBest,
}: Pick<ExerciseProgressRow, "weekBest" | "previousBest">) => {
  const current = `Tốt nhất tuần này ${formatSet(weekBest)}`;

  return previousBest
    ? [`Tốt nhất trước đó ${formatSet(previousBest)}`, current]
    : [current];
};
