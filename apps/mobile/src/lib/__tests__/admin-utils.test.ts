import { describe, expect, it } from "vitest";

import {
  canAssignPt,
  canManageFoods,
  dayTotals,
  emptyToNull,
  equalShares,
  exerciseBody,
  isPasscode,
  jpegDataUrl,
  mealTotals,
  moveId,
  normalizeSearch,
  parseNumber,
  sharesTotal,
  shiftWeek,
  shortDate,
  weekdayIndex,
  weekRange,
} from "../admin-utils";

describe("weeks", () => {
  it("shifts a week start by whole weeks", () => {
    expect(shiftWeek("2026-11-16", 1)).toBe("2026-11-23");
    expect(shiftWeek("2026-11-16", -2)).toBe("2026-11-02");
  });

  it("builds the from/to range of a week", () => {
    expect(weekRange("2026-11-16")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
  });

  it("formats dates", () => {
    expect(shortDate("2026-11-22")).toBe("22/11");
    expect(weekdayIndex("2026-11-16")).toBe(0);
    expect(weekdayIndex("2026-11-22")).toBe(6);
  });
});

describe("roles", () => {
  it("only a super admin manages foods and assigns PTs", () => {
    expect(canManageFoods("super_admin")).toBe(true);
    expect(canManageFoods("pt")).toBe(false);
    expect(canAssignPt("pt")).toBe(false);
  });
});

describe("input parsing", () => {
  it("accepts a decimal comma", () => {
    expect(parseNumber("1,6")).toBe(1.6);
    expect(parseNumber(" -200 ")).toBe(-200);
  });

  it("rejects text and empty input", () => {
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber("12a")).toBeNaN();
  });

  it("turns blank text into null", () => {
    expect(emptyToNull("  ")).toBeNull();
    expect(emptyToNull(" a ")).toBe("a");
  });

  it("validates a 4 digit passcode", () => {
    expect(isPasscode("0123")).toBe(true);
    expect(isPasscode("123")).toBe(false);
    expect(isPasscode("12a4")).toBe(false);
  });

  it("normalizes Vietnamese text for search", () => {
    expect(normalizeSearch("  Nguyễn Đức ")).toBe("nguyen duc");
  });
});

describe("exerciseBody", () => {
  const form = { title: "Squat", youtubeUrl: "u", sets: "4", reps: "8-10", description: "" };

  it("sends sets as a number", () => {
    expect(exerciseBody(form, true)).toMatchObject({ sets: 4, confirmResetSets: true });
  });

  it("sends null for empty or invalid sets", () => {
    expect(exerciseBody({ ...form, sets: "" }, false).sets).toBeNull();
    expect(exerciseBody({ ...form, sets: "x" }, false).sets).toBeNull();
  });
});

describe("meal totals", () => {
  const food = { kcal: 200, protein: 20, carbs: 10, fat: 5 };

  it("scales per 100 g values by the grams", () => {
    expect(mealTotals({ items: [{ grams: 150, food }] })).toEqual({
      kcal: 300,
      protein: 30,
      carbs: 15,
      fat: 7.5,
    });
  });

  it("sums the meals of a day", () => {
    const meal = { items: [{ grams: 100, food }] };

    expect(dayTotals({ meals: [meal, meal] }).kcal).toBe(400);
  });
});

describe("shares", () => {
  it("splits 100 equally and the parts add up", () => {
    expect(equalShares(3)).toEqual([33, 33, 34]);
    expect(equalShares(4).reduce((a, b) => a + b, 0)).toBe(100);
    expect(equalShares(0)).toEqual([]);
  });

  it("totals typed percentages and ignores bad ones", () => {
    expect(sharesTotal(["50", "25,5", "x"])).toBe(75.5);
  });
});

describe("moveId", () => {
  it("swaps with the neighbour", () => {
    expect(moveId([1, 2, 3], 2, "up")).toEqual([2, 1, 3]);
    expect(moveId([1, 2, 3], 2, "down")).toEqual([1, 3, 2]);
  });

  it("is a no-op at an edge or for an unknown id", () => {
    expect(moveId([1, 2], 1, "up")).toEqual([1, 2]);
    expect(moveId([1, 2], 9, "down")).toEqual([1, 2]);
  });
});

describe("avatar", () => {
  it("builds a JPEG data URL", () => {
    expect(jpegDataUrl("abc")).toBe("data:image/jpeg;base64,abc");
  });
});
