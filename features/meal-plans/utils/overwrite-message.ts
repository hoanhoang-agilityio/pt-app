import { formatDayMonth, getWeekdayShortLabel } from "@/utils/week";

// The chosen dates that already have a plan, in date order.
export const getOverwriteDates = (
  selected: string[],
  datesWithPlan: string[],
) => selected.filter((date) => datesWithPlan.includes(date)).sort();

// "Ghi đè plan của T3 27/10, T5 29/10?"
export const formatOverwriteQuestion = (dates: string[]) =>
  `Ghi đè plan của ${dates
    .map((date) => `${getWeekdayShortLabel(date)} ${formatDayMonth(date)}`)
    .join(", ")}?`;
