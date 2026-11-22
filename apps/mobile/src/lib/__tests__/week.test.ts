import { describe, expect, it } from "vitest";

import {
  dayAfterWeekChange,
  formatDayMonth,
  formatWeekRange,
  shiftWeek,
  weekdayIndexOf,
  weekStartOf,
} from "../week";

describe("week helpers", () => {
  it("starts weeks on Monday", () => {
    expect(weekStartOf("2026-11-22")).toBe("2026-11-16"); // Sunday
    expect(weekStartOf("2026-11-16")).toBe("2026-11-16");
    expect(weekdayIndexOf("2026-11-22")).toBe(6);
    expect(weekdayIndexOf("2026-11-16")).toBe(0);
  });
  it("shifts by whole weeks across a year end", () => {
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
    expect(shiftWeek("2026-11-16", -1)).toBe("2026-11-09");
  });
  it("formats day/month and ranges", () => {
    expect(formatDayMonth("2026-03-05")).toBe("05/03");
    expect(formatWeekRange("2026-12-28")).toBe("28/12 - 03/01");
  });
  it("keeps the weekday on a week change and snaps to today in this week", () => {
    expect(dayAfterWeekChange("2026-11-18", "2026-11-09", "2026-11-22")).toBe("2026-11-11");
    expect(dayAfterWeekChange("2026-11-11", "2026-11-16", "2026-11-22")).toBe("2026-11-22");
  });
});
