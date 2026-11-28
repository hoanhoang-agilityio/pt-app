import { describe, expect, it } from "vitest";

import { TRAINING_NOTE_MESSAGES as MESSAGES } from "@/features/training-notes/constants/messages";
import {
  type TrainingNoteInput,
  trainingNoteSchema,
} from "@/features/training-notes/utils/note-schema";

type ItemInput = TrainingNoteInput["items"][number];
type SetInput = ItemInput["sets"][number];

const set = (overrides: Partial<SetInput> = {}): SetInput => ({
  unit: "reps",
  reps: 8,
  durationSec: null,
  weightKg: 80,
  note: null,
  ...overrides,
});

const item = (overrides: Partial<ItemInput> = {}): ItemInput => ({
  exerciseName: "Squat",
  sets: [set()],
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

const withSets = (...sets: SetInput[]) => note({ items: [item({ sets })] });

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
    expect(result.items).toEqual([{ ...item(), exerciseRef: null }]);
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
                sets: [set({ reps: null, weightKg: null })],
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

    it("accepts an exercise with a name and no sets", () => {
      const result = trainingNoteSchema.parse(
        note({ items: [item({ sets: [] })] }),
      );

      expect(result.items).toEqual([
        { exerciseName: "Squat", exerciseRef: null, sets: [] },
      ]);
    });

    it("rejects sets without an exercise name", () => {
      expect(firstError(note({ items: [item({ exerciseName: " " })] }))).toBe(
        MESSAGES.EXERCISE_NAME_REQUIRED,
      );
    });
  });

  describe("sets", () => {
    it("drops a fully blank set row and keeps the others in order", () => {
      const result = trainingNoteSchema.parse(
        withSets(
          set({ reps: 10, weightKg: 60 }),
          set({ reps: null, weightKg: null, note: "  " }),
          set({ reps: 5, weightKg: 90 }),
        ),
      );

      expect(result.items[0].sets.map((s) => [s.reps, s.weightKg])).toEqual([
        [10, 60],
        [5, 90],
      ]);
    });

    it("keeps a weight-only set", () => {
      const result = trainingNoteSchema.parse(
        withSets(set({ reps: null, weightKg: 80 })),
      );

      expect(
        result.items[0].sets.map((s) => [s.reps, s.durationSec, s.weightKg]),
      ).toEqual([[null, null, 80]]);
    });

    it("keeps a note-only set", () => {
      const result = trainingNoteSchema.parse(
        withSets(
          set({ reps: null, weightKg: null, note: "Hơi đau vai" }),
          set({ unit: "seconds", reps: null, durationSec: null, note: "Ok" }),
        ),
      );

      expect(result.items[0].sets.map((s) => [s.unit, s.note])).toEqual([
        ["reps", "Hơi đau vai"],
        ["seconds", "Ok"],
      ]);
    });

    it("rejects the value of the other unit", () => {
      expect(firstError(withSets(set({ unit: "reps", durationSec: 45 })))).toBe(
        MESSAGES.REPS_OR_DURATION,
      );
      expect(
        firstError(
          withSets(set({ unit: "seconds", reps: 8, durationSec: null })),
        ),
      ).toBe(MESSAGES.REPS_OR_DURATION);
    });

    it("accepts reps and timed sets in one exercise", () => {
      const result = trainingNoteSchema.parse(
        withSets(
          set({ reps: 8 }),
          set({ unit: "seconds", reps: null, durationSec: 45, weightKg: null }),
        ),
      );

      expect(result.items[0].sets.map((s) => s.unit)).toEqual([
        "reps",
        "seconds",
      ]);
    });

    it("trims the note and stores a blank one as null", () => {
      const result = trainingNoteSchema.parse(
        withSets(set({ note: "  Giảm tạ  " }), set({ note: "   " })),
      );

      expect(result.items[0].sets.map((s) => s.note)).toEqual([
        "Giảm tạ",
        null,
      ]);
    });

    it("accepts a 120-character note and rejects 121", () => {
      expect(
        trainingNoteSchema.safeParse(withSets(set({ note: "n".repeat(120) })))
          .success,
      ).toBe(true);
      expect(firstError(withSets(set({ note: "n".repeat(121) })))).toBe(
        MESSAGES.SET_NOTE_TOO_LONG,
      );
    });

    it("accepts 20 sets and rejects 21", () => {
      const sets = (count: number) =>
        Array.from({ length: count }, () => set());

      expect(trainingNoteSchema.safeParse(withSets(...sets(20))).success).toBe(
        true,
      );
      expect(firstError(withSets(...sets(21)))).toBe(MESSAGES.TOO_MANY_SETS);
    });
  });

  describe("reps", () => {
    it.each([1, 99])("accepts %i", (value) => {
      expect(
        trainingNoteSchema.safeParse(withSets(set({ reps: value }))).success,
      ).toBe(true);
    });

    it.each([0, 100, 2.5, Number.NaN])("rejects reps %s", (value) => {
      expect(firstError(withSets(set({ reps: value })))).toBe(
        MESSAGES.REPS_RANGE,
      );
    });
  });

  describe("timed sets", () => {
    const timed = (durationSec: number) =>
      withSets(
        set({ unit: "seconds", reps: null, durationSec, weightKg: null }),
      );

    it.each([1, 3600])("accepts %i seconds", (seconds) => {
      expect(trainingNoteSchema.safeParse(timed(seconds)).success).toBe(true);
    });

    it.each([0, 3601, 1.5])("rejects %s seconds", (seconds) => {
      expect(firstError(timed(seconds))).toBe(MESSAGES.DURATION_RANGE);
    });
  });

  describe("weight", () => {
    it.each([0, 0.5, 500])("accepts %s kg", (kg) => {
      expect(
        trainingNoteSchema.safeParse(withSets(set({ weightKg: kg }))).success,
      ).toBe(true);
    });

    it.each([-0.5, 500.5, Number.NaN, Number.POSITIVE_INFINITY])(
      "rejects %s kg",
      (kg) => {
        expect(firstError(withSets(set({ weightKg: kg })))).toBe(
          MESSAGES.WEIGHT_RANGE,
        );
      },
    );

    it("treats a missing weight as bodyweight (null)", () => {
      const result = trainingNoteSchema.parse(
        withSets(set({ weightKg: undefined })),
      );

      expect(result.items[0].sets[0].weightKg).toBeNull();
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

  describe("exerciseRef", () => {
    const refOf = (exerciseRef: unknown) =>
      trainingNoteSchema.parse(note({ items: [item({ exerciseRef })] }))
        .items[0].exerciseRef;

    it("keeps a well-formed built-in or custom ref", () => {
      expect(refOf("b:Barbell_Squat")).toBe("b:Barbell_Squat");
      expect(refOf("c:12")).toBe("c:12");
    });

    it("reads a missing or malformed ref as no link without failing the save", () => {
      expect(refOf(undefined)).toBeNull();
      expect(refOf(null)).toBeNull();
      expect(refOf("c:0")).toBeNull();
      expect(refOf("b:a b")).toBeNull();
      expect(refOf(7)).toBeNull();
    });
  });
});
