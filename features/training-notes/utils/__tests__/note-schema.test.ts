import { describe, expect, it } from "vitest";

import { TRAINING_NOTE_MESSAGES as MESSAGES } from "@/features/training-notes/constants/messages";
import {
  type TrainingNoteInput,
  trainingNoteSchema,
} from "@/features/training-notes/utils/note-schema";

const item = (
  overrides: Partial<TrainingNoteInput["items"][number]> = {},
): TrainingNoteInput["items"][number] => ({
  exerciseName: "Squat",
  sets: 4,
  reps: 8,
  durationSec: null,
  weightKg: 80,
  ...overrides,
});

const note = (
  overrides: Partial<TrainingNoteInput> = {},
): TrainingNoteInput => ({
  date: "2026-11-25",
  title: "Ngày chân",
  note: "",
  items: [item()],
  ...overrides,
});

const firstError = (input: TrainingNoteInput) => {
  const result = trainingNoteSchema.safeParse(input);

  return result.success ? null : result.error.issues[0].message;
};

describe("trainingNoteSchema", () => {
  it("accepts a full note and normalizes blank text to null", () => {
    const result = trainingNoteSchema.parse(
      note({ title: "  ", note: undefined }),
    );

    expect(result.title).toBeNull();
    expect(result.note).toBeNull();
    expect(result.items).toEqual([item()]);
  });

  it("rejects an invalid or impossible date", () => {
    expect(firstError(note({ date: "25/11/2026" }))).toBe(
      MESSAGES.DATE_INVALID,
    );
    expect(firstError(note({ date: "2026-02-30" }))).toBe(
      MESSAGES.DATE_INVALID,
    );
  });

  describe("at least one exercise or a note", () => {
    it("rejects no items and no note", () => {
      expect(firstError(note({ items: [] }))).toBe(MESSAGES.EMPTY);
      expect(firstError(note({ items: [], note: "   " }))).toBe(MESSAGES.EMPTY);
    });

    it("drops the empty row the form always keeps", () => {
      expect(
        firstError(
          note({
            items: [
              item({
                exerciseName: "",
                sets: null,
                reps: null,
                weightKg: null,
              }),
            ],
          }),
        ),
      ).toBe(MESSAGES.EMPTY);
    });

    it("accepts a note alone", () => {
      const result = trainingNoteSchema.parse(
        note({ items: [], note: "Felt strong" }),
      );

      expect(result.items).toEqual([]);
      expect(result.note).toBe("Felt strong");
    });

    it("accepts an exercise alone", () => {
      expect(
        trainingNoteSchema.safeParse(
          note({ items: [item({ sets: null, reps: null, weightKg: null })] }),
        ).success,
      ).toBe(true);
    });

    it("rejects numbers without an exercise name", () => {
      expect(firstError(note({ items: [item({ exerciseName: " " })] }))).toBe(
        MESSAGES.EXERCISE_NAME_REQUIRED,
      );
    });
  });

  describe("sets and reps", () => {
    it.each([1, 99])("accepts %i", (value) => {
      expect(
        trainingNoteSchema.safeParse(
          note({ items: [item({ sets: value, reps: value })] }),
        ).success,
      ).toBe(true);
    });

    it.each([0, 100, -1, 1.5, Number.NaN])("rejects sets %s", (value) => {
      expect(firstError(note({ items: [item({ sets: value })] }))).toBe(
        MESSAGES.SETS_REPS_RANGE,
      );
    });

    it.each([0, 100, 2.5])("rejects reps %s", (value) => {
      expect(firstError(note({ items: [item({ reps: value })] }))).toBe(
        MESSAGES.SETS_REPS_RANGE,
      );
    });
  });

  describe("timed exercises", () => {
    const timed = (durationSec: number | null) =>
      note({
        items: [
          item({
            exerciseName: "Plank",
            sets: 3,
            reps: null,
            durationSec,
            weightKg: null,
          }),
        ],
      });

    it.each([1, 3600])("accepts %i seconds", (seconds) => {
      expect(trainingNoteSchema.safeParse(timed(seconds)).success).toBe(true);
    });

    it.each([0, 3601, 1.5])("rejects %s seconds", (seconds) => {
      expect(firstError(timed(seconds))).toBe(MESSAGES.DURATION_RANGE);
    });

    it("rejects reps and seconds on the same exercise", () => {
      expect(
        firstError(note({ items: [item({ reps: 8, durationSec: 45 })] })),
      ).toBe(MESSAGES.REPS_OR_DURATION);
    });
  });

  describe("weight", () => {
    it.each([0, 0.5, 500])("accepts %s kg", (kg) => {
      expect(
        trainingNoteSchema.safeParse(note({ items: [item({ weightKg: kg })] }))
          .success,
      ).toBe(true);
    });

    it.each([-0.5, 500.5, Number.NaN, Number.POSITIVE_INFINITY])(
      "rejects %s kg",
      (kg) => {
        expect(firstError(note({ items: [item({ weightKg: kg })] }))).toBe(
          MESSAGES.WEIGHT_RANGE,
        );
      },
    );

    it("treats a missing weight as bodyweight (null)", () => {
      const result = trainingNoteSchema.parse(
        note({ items: [item({ weightKg: undefined })] }),
      );

      expect(result.items[0].weightKg).toBeNull();
    });
  });

  describe("text limits", () => {
    it("accepts the maximum lengths", () => {
      expect(
        trainingNoteSchema.safeParse(
          note({
            title: "t".repeat(60),
            note: "n".repeat(1000),
            items: [item({ exerciseName: "e".repeat(60) })],
          }),
        ).success,
      ).toBe(true);
    });

    it("rejects one character over", () => {
      expect(firstError(note({ title: "t".repeat(61) }))).toBe(
        MESSAGES.TITLE_TOO_LONG,
      );
      expect(firstError(note({ note: "n".repeat(1001) }))).toBe(
        MESSAGES.NOTE_TOO_LONG,
      );
      expect(
        firstError(note({ items: [item({ exerciseName: "e".repeat(61) })] })),
      ).toBe(MESSAGES.EXERCISE_NAME_TOO_LONG);
    });
  });

  it("allows 20 exercises and rejects 21", () => {
    const items = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        item({ exerciseName: `Move ${index}` }),
      );

    expect(
      trainingNoteSchema.safeParse(note({ items: items(20) })).success,
    ).toBe(true);
    expect(firstError(note({ items: items(21) }))).toBe(
      MESSAGES.TOO_MANY_ITEMS,
    );
  });
});
