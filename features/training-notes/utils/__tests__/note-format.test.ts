import { describe, expect, it } from "vitest";

import type {
  TrainingNote,
  TrainingNoteItem,
  TrainingNoteSet,
} from "@/features/training-notes/types/training-note";
import {
  getRangeBounds,
  parseTrainingNoteRange,
} from "@/features/training-notes/utils/note-filters";
import {
  formatNoteDayLabel,
  formatSetChip,
  getSetNotes,
  groupNotesByDate,
  type ItemFormatter,
  summarizeNote,
} from "@/features/training-notes/utils/note-format";

const TEMPLATES: Record<string, string> = {
  "item.repsOnly": "{reps} rep",
  "item.secondsOnly": "{seconds} giây",
  "item.chipKgReps": "{kg} kg × {reps}",
  "item.chipKgSeconds": "{kg} kg × {seconds} giây",
  "item.chipKgOnly": "{kg} kg",
  "item.chipSet": "Set {n}",
};

// Numbers are rendered like next-intl does for Vietnamese: 82,5.
const viNumber = new Intl.NumberFormat("vi");

const format: ItemFormatter = (key, values) =>
  TEMPLATES[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    viNumber.format(values[name]),
  );

const rep = (reps: number | null, weightKg: number | null = null) => ({
  unit: "reps" as const,
  reps,
  durationSec: null,
  weightKg,
  note: null,
});
const sec = (durationSec: number, weightKg: number | null = null) => ({
  unit: "seconds" as const,
  reps: null,
  durationSec,
  weightKg,
  note: null,
});
const withPositions = (sets: Omit<TrainingNoteSet, "position">[]) =>
  sets.map((entry, position) => ({ ...entry, position }));

const item = (
  sets: Omit<TrainingNoteSet, "position">[],
  exerciseName = "Squat",
): TrainingNoteItem => ({
  id: 1,
  position: 0,
  exerciseName,
  sets: withPositions(sets),
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

describe("formatSetChip", () => {
  const chip = (set: Omit<TrainingNoteSet, "position">) =>
    formatSetChip({ ...set, position: 0 }, format);

  it("formats reps with and without kg", () => {
    expect(chip(rep(10, 60))).toBe("60 kg × 10");
    expect(chip(rep(10))).toBe("10 rep");
  });

  it("formats timed sets with and without kg", () => {
    expect(chip(sec(40, 24))).toBe("24 kg × 40 giây");
    expect(chip(sec(45))).toBe("45 giây");
  });

  it("renders a decimal weight with a comma", () => {
    expect(chip(rep(8, 82.5))).toBe("82,5 kg × 8");
  });

  it("keeps a zero weight", () => {
    expect(chip(rep(8, 0))).toBe("0 kg × 8");
  });

  it("formats a weight-only set as kg", () => {
    expect(chip(rep(null, 20))).toBe("20 kg");
    expect(chip({ ...sec(1, 20), durationSec: null })).toBe("20 kg");
  });

  it("labels a set without value or kg by its number", () => {
    expect(chip(rep(null))).toBe("Set 1");
    expect(formatSetChip({ ...rep(null), position: 2 }, format)).toBe("Set 3");
  });
});

describe("summarizeNote", () => {
  it("counts the exercises and the sets across them", () => {
    const summary = summarizeNote(
      note(1, "2026-11-25", {
        items: [
          item([rep(10, 60), rep(10, 60), rep(8, 62.5)], "Squat"),
          item([sec(45)], "Plank"),
          item([rep(12), rep(12)], "Dip"),
        ],
      }),
    );

    expect(summary).toEqual({ exercises: 3, sets: 6 });
  });

  it("is zero for a note without exercises", () => {
    expect(summarizeNote(note(1, "2026-11-25"))).toEqual({
      exercises: 0,
      sets: 0,
    });
  });

  it("skips a set that holds nothing but keeps one with only a note", () => {
    const empty = { ...rep(null), note: null };
    const onlyNote = { ...rep(null), note: "Hơi đau vai" };
    const summary = summarizeNote(
      note(1, "2026-11-25", { items: [item([empty, onlyNote, rep(5)])] }),
    );

    expect(summary).toEqual({ exercises: 1, sets: 2 });
  });
});

describe("getSetNotes", () => {
  it("lists the notes with their 1-based set number", () => {
    const squat = item([rep(10), rep(8), rep(5)]);

    squat.sets[2].note = "Hơi đau vai";
    squat.sets[0].note = "Chậm";
    expect(getSetNotes(squat)).toEqual([
      { itemId: 1, setNumber: 1, note: "Chậm" },
      { itemId: 1, setNumber: 3, note: "Hơi đau vai" },
    ]);
    expect(getSetNotes(item([rep(8)]))).toEqual([]);
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

describe("formatNoteDayLabel", () => {
  it("omits the year for the current year", () => {
    expect(formatNoteDayLabel("2026-11-25", "vi", "2026")).toBe(
      "Thứ Tư, 25/11",
    );
  });

  it("adds the year for other years in every locale", () => {
    expect(formatNoteDayLabel("2025-11-26", "vi", "2026")).toBe(
      "Thứ Tư, 26/11/2025",
    );
    expect(formatNoteDayLabel("2025-11-26", "en", "2026")).toBe(
      "Wednesday, Nov 26, 2025",
    );
    expect(formatNoteDayLabel("2025-11-26", "zh", "2026")).toContain(
      "2025年11月26日",
    );
  });
});
