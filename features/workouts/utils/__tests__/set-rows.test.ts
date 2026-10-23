import { describe, expect, it } from "vitest";

import { WORKOUT_MESSAGES } from "@/features/workouts/constants/messages";
import {
  createInitialRows,
  formatSet,
  rowsToSetInputs,
  type SetRowDraft,
} from "@/features/workouts/utils/set-rows";

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
    ).toEqual([row("42.5", "8", 0), row("", "12", 1)]);
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
      message: WORKOUT_MESSAGES.SET_WEIGHT_STEP,
    });
  });

  it("rejects text that is not a number", () => {
    expect(rowsToSetInputs([row("abc", "10")])).toEqual({
      ok: false,
      message: WORKOUT_MESSAGES.SET_WEIGHT_RANGE,
    });
    expect(rowsToSetInputs([row("40", "x")])).toEqual({
      ok: false,
      message: WORKOUT_MESSAGES.SET_REPS_RANGE,
    });
  });

  it("rejects fractional reps", () => {
    expect(rowsToSetInputs([row("40", "8.5")])).toEqual({
      ok: false,
      message: WORKOUT_MESSAGES.SET_REPS_INTEGER,
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
