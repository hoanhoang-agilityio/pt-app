import { addDays, getTodayDate, getWeekDates, getWeekStart } from "@pt/contracts";

// Week navigation on Vietnam calendar days ("YYYY-MM-DD" strings). Weeks run
// Monday to Sunday, like the web.

export const today = () => getTodayDate();

export const weekStartOf = (date: string) => getWeekStart(date);

export const weekDatesOf = (weekStart: string) => getWeekDates(weekStart);

export const shiftWeek = (weekStart: string, weeks: number) =>
  addDays(weekStart, weeks * 7);

// The selected day after a week change keeps its weekday; today wins when the
// target week is the current one.
export const dayAfterWeekChange = (
  selected: string,
  nextWeekStart: string,
  todayDate: string,
) => {
  if (weekStartOf(todayDate) === nextWeekStart) {
    return todayDate;
  }
  const offset = Math.round(
    (Date.parse(`${selected}T00:00:00Z`) -
      Date.parse(`${weekStartOf(selected)}T00:00:00Z`)) /
      86_400_000,
  );

  return addDays(nextWeekStart, offset);
};

// "22/11" (day/month); the year is not needed inside one week.
export const formatDayMonth = (date: string) => {
  const [, month, day] = date.split("-");

  return `${day}/${month}`;
};

export const formatWeekRange = (weekStart: string) =>
  `${formatDayMonth(weekStart)} - ${formatDayMonth(addDays(weekStart, 6))}`;

export const weekdayIndexOf = (date: string) =>
  (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
