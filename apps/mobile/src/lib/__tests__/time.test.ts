import { describe, expect, it } from "vitest";

import { formatAge, formatClock, formatDate, formatDayLabel, formatListTime } from "../time";

const labels = { today: "Hôm nay", yesterday: "Hôm qua" };
const now = new Date(2026, 10, 22, 15, 30);
const local = (y: number, m: number, d: number, h = 9, min = 5) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe("time formats", () => {
  it("pads the clock", () => {
    expect(formatClock(new Date(2026, 0, 1, 7, 4))).toBe("07:04");
  });

  it("orders the date per locale", () => {
    const date = new Date(2026, 10, 3);

    expect(formatDate(date, "vi")).toBe("03/11/2026");
    expect(formatDate(date, "en")).toBe("11/03/2026");
    expect(formatDate(date, "zh")).toBe("2026/11/03");
    expect(formatDate(date, "vi", false)).toBe("03/11");
  });

  it("labels today, yesterday and older days (year only when it differs)", () => {
    expect(formatDayLabel(local(2026, 11, 22), now, "vi", labels)).toBe("Hôm nay");
    expect(formatDayLabel(local(2026, 11, 21), now, "vi", labels)).toBe("Hôm qua");
    expect(formatDayLabel(local(2026, 11, 3), now, "vi", labels)).toBe("03/11");
    expect(formatDayLabel(local(2025, 12, 31), now, "vi", labels)).toBe("31/12/2025");
  });

  it("shows the clock for today in the inbox list", () => {
    expect(formatListTime(local(2026, 11, 22, 8, 9), now, "vi", labels)).toBe("08:09");
    expect(formatListTime(local(2026, 11, 21), now, "vi", labels)).toBe("Hôm qua");
    expect(formatListTime(null, now, "vi", labels)).toBe("");
    expect(formatListTime("garbage", now, "vi", labels)).toBe("");
  });

  it("formats ages", () => {
    const age = { now: "now", minutes: "{{count}}m", hours: "{{count}}h", days: "{{count}}d" };
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

    expect(formatAge(ago(10_000), now, "en", age)).toBe("now");
    expect(formatAge(ago(5 * 60_000), now, "en", age)).toBe("5m");
    expect(formatAge(ago(3 * 3_600_000), now, "en", age)).toBe("3h");
    expect(formatAge(ago(2 * 86_400_000), now, "en", age)).toBe("2d");
    expect(formatAge(ago(30 * 86_400_000), now, "en", age)).toBe("10/23");
  });
});
