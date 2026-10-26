import { describe, expect, it } from "vitest";

import { WORKOUT_MESSAGES } from "@/features/workouts/constants/messages";
import {
  canShowLoggedSets,
  createInitialRows,
  formatSet,
  getLoggedSetsKey,
  getRowHint,
  hintToDraftValues,
  rowsToSetInputs,
  type SetRowDraft,
} from "@/features/workouts/utils/set-logger";

const row = (weight: string, reps: string, id = 0): SetRowDraft => ({
  id,
  weight,
  reps,
});

describe("createInitialRows", () => {
  it("starts with 1 empty row when sets is null (E1)", () => {
    expect(createInitialRows([], null)).toEqual([row("", "")]);
  });

  it("prefills one row per planned set (Q1)", () => {
    expect(createInitialRows([], 4)).toHaveLength(4);
  });

  it("caps planned rows at 10 and floors them at 1 (Q14)", () => {
    expect(createInitialRows([], 12)).toHaveLength(10);
    expect(createInitialRows([], 0)).toHaveLength(1);
  });

  it("uses saved sets over the planned count, bodyweight as empty kg", () => {
    expect(
      createInitialRows(
        [
          { weightKg: 42.5, reps: 8 },
          { weightKg: null, reps: 12 },
        ],
        4,
      ),
    ).toEqual([row("42,5", "8", 0), row("", "12", 1)]);
  });
});

describe("rowsToSetInputs", () => {
  it("parses kg with a comma or a dot and empty kg as bodyweight", () => {
    expect(
      rowsToSetInputs([row("42,5", "8"), row("40.5", "10"), row("", "12")]),
    ).toEqual({
      ok: true,
      sets: [
        { weightKg: 42.5, reps: 8 },
        { weightKg: 40.5, reps: 10 },
        { weightKg: null, reps: 12 },
      ],
    });
  });

  it("drops fully blank rows, so all-blank saves an empty list", () => {
    expect(rowsToSetInputs([row(" ", ""), row("", "")])).toEqual({
      ok: true,
      sets: [],
    });
  });

  it("asks for reps when only the weight is filled", () => {
    expect(rowsToSetInputs([row("40", "10"), row("40", "")])).toEqual({
      ok: false,
      message: "Nhập số lần cho hiệp 2",
    });
  });

  it("rejects a weight off the 0.5 step with the server's message", () => {
    expect(rowsToSetInputs([row("40,25", "10")])).toEqual({
      ok: false,
      message: `Hiệp 1: ${WORKOUT_MESSAGES.SET_WEIGHT_STEP}`,
    });
  });

  it("names the visible row even after a blank row is dropped", () => {
    expect(
      rowsToSetInputs([row("40", "10"), row("", ""), row("600", "5")]),
    ).toEqual({
      ok: false,
      message: `Hiệp 3: ${WORKOUT_MESSAGES.SET_WEIGHT_RANGE}`,
    });
  });

  it("rejects exponent and hex forms that Number() would accept", () => {
    expect(rowsToSetInputs([row("1e2", "10")]).ok).toBe(false);
    expect(rowsToSetInputs([row("0x14", "10")]).ok).toBe(false);
    expect(rowsToSetInputs([row("40", "1e1")]).ok).toBe(false);
  });

  it("rejects text that is not a number", () => {
    expect(rowsToSetInputs([row("abc", "10")])).toEqual({
      ok: false,
      message: `Hiệp 1: ${WORKOUT_MESSAGES.SET_WEIGHT_RANGE}`,
    });
    expect(rowsToSetInputs([row("40", "x")])).toEqual({
      ok: false,
      message: `Hiệp 1: ${WORKOUT_MESSAGES.SET_REPS_RANGE}`,
    });
  });

  it("rejects fractional reps", () => {
    expect(rowsToSetInputs([row("40", "8.5")])).toEqual({
      ok: false,
      message: `Hiệp 1: ${WORKOUT_MESSAGES.SET_REPS_INTEGER}`,
    });
  });

  it("rejects more than 10 filled rows", () => {
    const rows = Array.from({ length: 11 }, (_, id) => row("40", "10", id));

    expect(rowsToSetInputs(rows)).toEqual({
      ok: false,
      message: WORKOUT_MESSAGES.SET_TOO_MANY,
    });
  });
});

describe("formatSet", () => {
  it("formats weighted and bodyweight sets with a decimal comma", () => {
    expect(formatSet({ weightKg: 40, reps: 10 })).toBe("40 kg × 10");
    expect(formatSet({ weightKg: 42.5, reps: 8 })).toBe("42,5 kg × 8");
    expect(formatSet({ weightKg: null, reps: 12 })).toBe("Tự trọng × 12");
  });
});

describe("getLoggedSetsKey", () => {
  it("changes when a saved set changes and is stable otherwise", () => {
    const sets = [
      { weightKg: 40, reps: 10 },
      { weightKg: null, reps: 12 },
    ];

    expect(getLoggedSetsKey(sets)).toBe(getLoggedSetsKey([...sets]));
    expect(getLoggedSetsKey(sets)).not.toBe(
      getLoggedSetsKey([{ weightKg: 40, reps: 11 }, sets[1]]),
    );
    expect(getLoggedSetsKey([])).toBe("");
  });
});

describe("getRowHint", () => {
  const previous = [
    { weightKg: 40, reps: 10 },
    { weightKg: null, reps: 12 },
  ];

  it("returns the previous set at the same position (E7)", () => {
    expect(getRowHint(previous, 0)).toEqual({ weightKg: 40, reps: 10 });
    expect(getRowHint(previous, 1)).toEqual({ weightKg: null, reps: 12 });
  });

  it("returns null past the previous count, with no history or a bad index", () => {
    expect(getRowHint(previous, 2)).toBeNull();
    expect(getRowHint([], 0)).toBeNull();
    expect(getRowHint(previous, -1)).toBeNull();
  });
});

describe("hintToDraftValues", () => {
  it("writes a weighted hint with a decimal comma", () => {
    expect(hintToDraftValues({ weightKg: 40, reps: 10 })).toEqual({
      weight: "40",
      reps: "10",
    });
    expect(hintToDraftValues({ weightKg: 42.5, reps: 8 }).weight).toBe("42,5");
  });

  it("leaves the weight empty for a bodyweight hint", () => {
    expect(hintToDraftValues({ weightKg: null, reps: 12 })).toEqual({
      weight: "",
      reps: "12",
    });
  });

  it("round-trips through rowsToSetInputs", () => {
    const set = { weightKg: 42.5, reps: 8 };

    expect(rowsToSetInputs([{ id: 0, ...hintToDraftValues(set) }])).toEqual({
      ok: true,
      sets: [set],
    });
  });
});

describe("canShowLoggedSets", () => {
  it("shows the read-only list for a timed exercise that has sets", () => {
    expect(canShowLoggedSets({ reps: "30s" }, 2)).toBe(true);
    expect(canShowLoggedSets({ reps: "1 phút" }, 1)).toBe(true);
  });

  it("hides it for a timed exercise without sets", () => {
    expect(canShowLoggedSets({ reps: "30s" }, 0)).toBe(false);
  });

  it("leaves non-timed exercises to the logger", () => {
    expect(canShowLoggedSets({ reps: "8-12" }, 3)).toBe(false);
    expect(canShowLoggedSets({ reps: "10" }, 0)).toBe(false);
  });
});
