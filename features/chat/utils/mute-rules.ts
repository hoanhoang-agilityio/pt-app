import { z } from "zod";

// Pure rules for per-person notification mutes (Zalo style). A mute row has an
// optional end; null means "until turned back on". A row whose end has passed
// counts as unmuted at read time, so nothing has to clean it up.

export const MUTE_DURATIONS = [
  "1h",
  "4h",
  "8h",
  "tomorrow8",
  "forever",
] as const;

export type MuteDuration = (typeof MUTE_DURATIONS)[number];

export const muteDurationSchema = z.enum(MUTE_DURATIONS);

// Browser `Date#getTimezoneOffset()` style: minutes UTC is ahead of local
// time (Vietnam is -420). The widest real offsets are -840 .. +720.
export const TZ_OFFSET_MIN = -840;
export const TZ_OFFSET_MAX = 720;

export const tzOffsetSchema = z
  .number()
  .int()
  .min(TZ_OFFSET_MIN)
  .max(TZ_OFFSET_MAX);

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MORNING_HOUR = 8;

const HOURS: Partial<Record<MuteDuration, number>> = {
  "1h": 1,
  "4h": 4,
  "8h": 8,
};

// When the mute ends; null = until turned back on. "tomorrow8" is 08:00 of
// the next local day, where local time is `now` shifted by `tzOffsetMinutes`
// (default 0 = UTC).
export const resolveMuteUntil = (
  duration: MuteDuration,
  now: Date,
  tzOffsetMinutes = 0,
): Date | null => {
  if (duration === "forever") {
    return null;
  }
  const hours = HOURS[duration];

  if (hours !== undefined) {
    return new Date(now.getTime() + hours * HOUR_MS);
  }
  // Shift into local wall-clock time, take the next local midnight, add 8 h,
  // shift back.
  const localMs = now.getTime() - tzOffsetMinutes * MINUTE_MS;
  const nextLocalMidnight = (Math.floor(localMs / DAY_MS) + 1) * DAY_MS;

  return new Date(
    nextLocalMidnight + MORNING_HOUR * HOUR_MS + tzOffsetMinutes * MINUTE_MS,
  );
};

export interface MuteRow {
  mutedUntil: Date | null;
}

// Active while there is no end (forever) or the end is still ahead.
export const isMuteActive = (row: MuteRow, now: Date): boolean =>
  row.mutedUntil === null || row.mutedUntil.getTime() > now.getTime();

// What the pages hand to the client: whether the chat is muted now and, if so,
// when it ends (ISO string, null = until turned back on).
export interface MuteState {
  muted: boolean;
  until: string | null;
}

export const UNMUTED: MuteState = { muted: false, until: null };

export const toMuteState = (
  row: { mutedUntil: Date | null } | undefined,
  now: Date,
): MuteState =>
  row && isMuteActive(row, now)
    ? { muted: true, until: row.mutedUntil?.toISOString() ?? null }
    : UNMUTED;

// "15:30" for today, "15:30 29/11" for a later day; 24-hour clock in the
// viewer's zone (`timeZone` only for tests).
export const formatMuteUntil = (
  until: Date,
  now: Date,
  locale: string,
  timeZone?: string,
): string => {
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(until);
  const dayKey = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);

  if (dayKey(until) === dayKey(now)) {
    return time;
  }
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
  }).format(until);

  return `${time} ${day}`;
};
