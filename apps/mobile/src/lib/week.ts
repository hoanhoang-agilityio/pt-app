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

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad2 = (value: number) => String(value).padStart(2, "0");

// Vietnam is UTC+7 all year, so no Intl time zone support is needed.
const toVn = (iso: string) => new Date(Date.parse(iso) + VN_OFFSET_MS);

export const formatVnClock = (iso: string) => {
  const date = toVn(iso);

  return Number.isNaN(date.getTime())
    ? ""
    : `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
};

export const formatVnShortDate = (iso: string) => {
  const date = toVn(iso);

  return Number.isNaN(date.getTime())
    ? ""
    : `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}`;
};
