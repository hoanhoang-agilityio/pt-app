import { formatDayMonth, getWeekdayShortLabel } from "@/utils/week";

// The chosen dates that already have a plan, in date order.
export const getOverwriteDates = (
  selected: string[],
  datesWithPlan: string[],
) => selected.filter((date) => datesWithPlan.includes(date)).sort();

const formatDates = (dates: string[]) =>
  dates
    .map((date) => `${getWeekdayShortLabel(date)} ${formatDayMonth(date)}`)
    .join(", ");

// "Ghi đè plan của T3 27/10, T5 29/10?"
export const formatOverwriteQuestion = (dates: string[]) =>
  `Ghi đè plan của ${formatDates(dates)}?`;

// Overwriting a day also deletes what the trainee logged on it (KAN-71):
// "Học viên đã ghi bữa ăn ở T3 27/10; ghi đè sẽ xóa nhật ký đó." Null when
// none of the days to overwrite has logs or marks.
export const formatOverwriteLogWarning = (
  overwriteDates: string[],
  datesWithLogs: string[],
) => {
  const logged = overwriteDates.filter((date) => datesWithLogs.includes(date));

  return logged.length
    ? `Học viên đã ghi bữa ăn ở ${formatDates(logged)}; ghi đè sẽ xóa nhật ký đó.`
    : null;
};

export const formatDeletePlanQuestion = (hasLogs: boolean) =>
  hasLogs
    ? "Xóa plan của ngày này? Học viên đã ghi bữa ăn ở ngày này, xóa plan sẽ xóa nhật ký đó."
    : "Xóa plan của ngày này?";
