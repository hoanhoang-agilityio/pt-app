// Date and time text for lists and chat. Hermes ships a partial Intl, so the
// formats are built by hand: they are the same on every device and testable.

export type AppLocale = "vi" | "en" | "zh";

const pad = (value: number) => String(value).padStart(2, "0");

export const formatClock = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const formatDate = (date: Date, locale: AppLocale, withYear = true) => {
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = String(date.getFullYear());

  if (locale === "en") {
    return withYear ? `${month}/${day}/${year}` : `${month}/${day}`;
  }
  if (locale === "zh") {
    return withYear ? `${year}/${month}/${day}` : `${month}/${day}`;
  }
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// Whole calendar days between two dates (positive when `date` is earlier).
export const daysBetween = (date: Date, now: Date) =>
  Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

export type DayLabels = { today: string; yesterday: string };

// "Today", "Yesterday", or the date (year only when it is not this year).
export const formatDayLabel = (
  iso: string,
  now: Date,
  locale: AppLocale,
  labels: DayLabels,
) => {
  const date = new Date(iso);
  const diff = daysBetween(date, now);

  if (diff === 0) {
    return labels.today;
  }
  if (diff === 1) {
    return labels.yesterday;
  }
  return formatDate(date, locale, date.getFullYear() !== now.getFullYear());
};

// Inbox rows: the clock today, "Yesterday", else the short date.
export const formatListTime = (
  iso: string | null,
  now: Date,
  locale: AppLocale,
  labels: DayLabels,
) => {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diff = daysBetween(date, now);

  if (diff === 0) {
    return formatClock(date);
  }
  if (diff === 1) {
    return labels.yesterday;
  }
  return formatDate(date, locale, date.getFullYear() !== now.getFullYear());
};

// "5m", "3h", "2d" style age for posts and notifications.
export const formatAge = (
  iso: string,
  now: Date,
  locale: AppLocale,
  labels: { now: string; minutes: string; hours: string; days: string },
) => {
  const date = new Date(iso);
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (seconds < 60) {
    return labels.now;
  }
  if (seconds < 3600) {
    return labels.minutes.replace("{{count}}", String(Math.floor(seconds / 60)));
  }
  if (seconds < 86_400) {
    return labels.hours.replace("{{count}}", String(Math.floor(seconds / 3600)));
  }
  if (seconds < 7 * 86_400) {
    return labels.days.replace("{{count}}", String(Math.floor(seconds / 86_400)));
  }
  return formatDate(date, locale, date.getFullYear() !== now.getFullYear());
};
