import { describe, expect, it } from "vitest";

import type {
  TrainingNote,
  TrainingNoteItem,
} from "@/features/training-notes/types/training-note";
import {
  getRangeBounds,
  matchesNoteQuery,
  parseTrainingNoteRange,
} from "@/features/training-notes/utils/note-filters";
import {
  formatItemLine,
  groupNotesByDate,
  type ItemFormatter,
} from "@/features/training-notes/utils/note-format";

const TEMPLATES: Record<string, string> = {
  "item.setsReps": "{sets} × {reps}",
  "item.setsSeconds": "{sets} × {seconds} giây",
  "item.repsOnly": "{reps} rep",
  "item.secondsOnly": "{seconds} giây",
  "item.setsOnly": "{sets} set",
  "item.weight": "{kg} kg",
};

const format: ItemFormatter = (key, values) =>
  TEMPLATES[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name]),
  );

const item = (overrides: Partial<TrainingNoteItem>): TrainingNoteItem => ({
  id: 1,
  position: 0,
  exerciseName: "Squat",
  sets: null,
  reps: null,
  durationSec: null,
  weightKg: null,
  ...overrides,
});

const note = (
  id: number,
  date: string,
  overrides: Partial<TrainingNote> = {},
) => ({
  id,
  date,
  title: null,
  note: null,
  items: [],
  ...overrides,
});

describe("formatItemLine", () => {
  it("formats sets x reps with weight", () => {
    expect(
      formatItemLine(item({ sets: 4, reps: 8, weightKg: 80 }), format),
    ).toBe("Squat · 4 × 8 · 80 kg");
  });

  it("formats a timed exercise in seconds", () => {
    expect(
      formatItemLine(
        item({ exerciseName: "Plank", sets: 3, durationSec: 45 }),
        format,
      ),
    ).toBe("Plank · 3 × 45 giây");
  });

  it("formats partial values", () => {
    expect(formatItemLine(item({ reps: 12 }), format)).toBe("Squat · 12 rep");
    expect(formatItemLine(item({ durationSec: 30 }), format)).toBe(
      "Squat · 30 giây",
    );
    expect(formatItemLine(item({ sets: 5 }), format)).toBe("Squat · 5 set");
    expect(formatItemLine(item({ weightKg: 0 }), format)).toBe("Squat · 0 kg");
    expect(formatItemLine(item({}), format)).toBe("Squat");
  });
});

describe("groupNotesByDate", () => {
  it("groups consecutive notes of the same day and keeps the order", () => {
    const groups = groupNotesByDate(
      [note(3, "2026-11-25"), note(2, "2026-11-25"), note(1, "2026-11-20")],
      (date) => `label ${date}`,
    );

    expect(groups.map((g) => [g.label, g.notes.map((n) => n.id)])).toEqual([
      ["label 2026-11-25", [3, 2]],
      ["label 2026-11-20", [1]],
    ]);
  });
});

describe("getRangeBounds", () => {
  it("returns Monday to Sunday for the week", () => {
    // 2026-11-25 is a Wednesday.
    expect(getRangeBounds("week", "2026-11-25")).toEqual({
      from: "2026-11-23",
      to: "2026-11-29",
    });
  });

  it("covers the calendar month", () => {
    expect(getRangeBounds("month", "2026-11-25")).toEqual({
      from: "2026-11-01",
      to: "2026-11-31",
    });
  });

  it("has no bounds for all", () => {
    expect(getRangeBounds("all", "2026-11-25")).toBeNull();
  });
});

describe("parseTrainingNoteRange", () => {
  it("falls back to all", () => {
    expect(parseTrainingNoteRange("week")).toBe("week");
    expect(parseTrainingNoteRange("year")).toBe("all");
    expect(parseTrainingNoteRange(undefined)).toBe("all");
  });
});

describe("matchesNoteQuery", () => {
  const target = note(1, "2026-11-25", {
    title: "Ngày chân",
    note: "Đau gối nhẹ",
    items: [item({ exerciseName: "Squat" })],
  });

  it("matches title, note and exercise names without accents or case", () => {
    expect(matchesNoteQuery(target, "ngay chan")).toBe(true);
    expect(matchesNoteQuery(target, "GOI")).toBe(true);
    expect(matchesNoteQuery(target, "squ")).toBe(true);
    expect(matchesNoteQuery(target, "deadlift")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(matchesNoteQuery(target, "  ")).toBe(true);
  });
});
