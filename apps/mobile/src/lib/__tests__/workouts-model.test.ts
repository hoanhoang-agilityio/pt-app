import { describe, expect, it } from "vitest";

import {
  calculatePercent,
  canLogSets,
  canShowLoggedSets,
  createInitialRows,
  formatDecimal,
  formatSet,
  getDayProgress,
  getRowHint,
  getWeekProgress,
  hintToDraftValues,
  isDayComplete,
  isEmptyFirstSave,
  isTimedReps,
  rowsToSetInputs,
} from "../workouts-model";

describe("isTimedReps", () => {
  it.each(["30s", "45 sec", "1 phút", "30 seconds", "1p30", "30s mỗi bên"])(
    "%s is timed",
    (reps) => expect(isTimedReps(reps)).toBe(true),
  );
  it.each(["10-12", "8", "12 lần", ""])("%s is not timed", (reps) =>
    expect(isTimedReps(reps)).toBe(false),
  );
});

describe("set logging gates", () => {
  it("allows set rows only for due, non-timed exercises", () => {
    expect(canLogSets({ reps: "10" }, true)).toBe(true);
    expect(canLogSets({ reps: "10" }, false)).toBe(false);
    expect(canLogSets({ reps: "30s" }, true)).toBe(false);
  });
  it("shows saved sets read-only for a timed exercise", () => {
    expect(canShowLoggedSets({ reps: "30s" }, 2)).toBe(true);
    expect(canShowLoggedSets({ reps: "30s" }, 0)).toBe(false);
    expect(canShowLoggedSets({ reps: "10" }, 2)).toBe(false);
  });
});

describe("rows", () => {
  it("seeds saved sets then empty rows up to the plan", () => {
    const rows = createInitialRows([{ weightKg: 42.5, reps: 8 }], 3);

    expect(rows.map((row) => [row.weight, row.reps])).toEqual([
      ["42,5", "8"],
      ["", ""],
      ["", ""],
    ]);
  });
  it("starts with one row when the PT planned no sets", () => {
    expect(createInitialRows([], null)).toHaveLength(1);
  });
  it("never exceeds 10 rows", () => {
    expect(createInitialRows([], 50)).toHaveLength(10);
  });
  it("turns a hint into draft values, bodyweight leaving the weight empty", () => {
    expect(hintToDraftValues({ weightKg: null, reps: 12 })).toEqual({
      weight: "",
      reps: "12",
    });
    expect(getRowHint([{ weightKg: 40, reps: 10 }], 1)).toBeNull();
  });
});

describe("rowsToSetInputs", () => {
  const row = (weight: string, reps: string, id = 0) => ({ id, weight, reps });

  it("drops blank rows and reads comma decimals and bodyweight", () => {
    expect(
      rowsToSetInputs([row("42,5", "8"), row("", ""), row("", "12", 2)]),
    ).toEqual({
      ok: true,
      sets: [
        { weightKg: 42.5, reps: 8 },
        { weightKg: null, reps: 12 },
      ],
    });
  });
  it("names the row that lacks reps", () => {
    expect(rowsToSetInputs([row("40", "8"), row("40", "", 1)])).toEqual({
      ok: false,
      error: "missingReps",
      setNumber: 2,
    });
  });
  it("rejects a weight that is not a multiple of 0.5", () => {
    expect(rowsToSetInputs([row("40,3", "8")])).toEqual({
      ok: false,
      error: "weightStep",
      setNumber: 1,
    });
  });
  it("rejects weight 0 and reps above 100", () => {
    expect(rowsToSetInputs([row("0", "8")])).toMatchObject({ error: "weight" });
    expect(rowsToSetInputs([row("40", "101")])).toMatchObject({ error: "reps" });
  });
  it("rejects fractional reps and garbage", () => {
    expect(rowsToSetInputs([row("40", "8.5")])).toMatchObject({
      error: "repsInteger",
    });
    expect(rowsToSetInputs([row("abc", "8")])).toMatchObject({ error: "weight" });
    expect(rowsToSetInputs([row("40", "x")])).toMatchObject({ error: "reps" });
  });
  it("refuses more than 10 sets", () => {
    const rows = Array.from({ length: 11 }, (_, id) => row("40", "8", id));

    expect(rowsToSetInputs(rows)).toEqual({
      ok: false,
      error: "tooMany",
      setNumber: 0,
    });
  });
  it("flags an all-blank first save only", () => {
    expect(isEmptyFirstSave(0, 0)).toBe(true);
    expect(isEmptyFirstSave(0, 2)).toBe(false);
  });
});

describe("progress", () => {
  const day = (done: boolean[]) => ({
    exercises: done.map((value) => ({ completedAt: value ? "2026-01-01T00:00:00Z" : null })),
  });

  it("counts completed exercises", () => {
    expect(getDayProgress(day([true, false, true, true]))).toEqual({
      completed: 3,
      total: 4,
      percent: 75,
    });
  });
  it("sums a week and treats empty as 0%", () => {
    expect(getWeekProgress([day([true]), day([false, false]), day([])])).toEqual({
      completed: 1,
      total: 3,
      percent: 33,
    });
    expect(calculatePercent(0, 0)).toBe(0);
  });
  it("is complete only when every exercise is done", () => {
    expect(isDayComplete(day([true, true]))).toBe(true);
    expect(isDayComplete(day([true, false]))).toBe(false);
    expect(isDayComplete(day([]))).toBe(false);
  });
});

describe("formatting", () => {
  it("uses the decimal comma in Vietnamese only", () => {
    expect(formatDecimal(72.5)).toBe("72,5");
    expect(formatDecimal(72.5, "en")).toBe("72.5");
    expect(formatDecimal(40)).toBe("40");
  });
  it("formats a set", () => {
    expect(formatSet({ weightKg: 42.5, reps: 8 }, "BW")).toBe("42,5 kg × 8");
    expect(formatSet({ weightKg: null, reps: 12 }, "BW")).toBe("BW × 12");
  });
});
