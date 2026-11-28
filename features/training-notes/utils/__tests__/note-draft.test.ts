import { describe, expect, it } from "vitest";

import type { TrainingNote } from "@/features/training-notes/types/training-note";
import {
  createSetFrom,
  getNextKey,
  type ItemDraft,
  moveItem,
  summarizeItem,
  toDraft,
  toInput,
} from "@/features/training-notes/utils/note-draft";
import { trainingNoteSchema } from "@/features/training-notes/utils/note-schema";

const saved: TrainingNote = {
  id: 7,
  date: "2026-11-24",
  title: "Full body",
  note: null,
  items: [
    {
      id: 1,
      position: 0,
      exerciseName: "Squat",
      exerciseRef: null,
      muscles: null,
      sets: [
        {
          position: 0,
          unit: "reps",
          reps: 10,
          durationSec: null,
          weightKg: 62.5,
          note: null,
        },
        {
          position: 1,
          unit: "reps",
          reps: 5,
          durationSec: null,
          weightKg: 90,
          note: "Hơi đau vai",
        },
      ],
    },
    {
      id: 2,
      position: 1,
      exerciseName: "Plank",
      exerciseRef: null,
      muscles: null,
      sets: [
        {
          position: 0,
          unit: "seconds",
          reps: null,
          durationSec: 45,
          weightKg: null,
          note: null,
        },
      ],
    },
  ],
};

describe("toDraft", () => {
  it("opens an empty note with one expanded exercise and one set", () => {
    const draft = toDraft(null, "2026-11-26");

    expect(draft).toMatchObject({ date: "2026-11-26", title: "", note: "" });
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]).toMatchObject({ name: "", open: true });
    expect(draft.items[0].sets).toHaveLength(1);
  });

  it("expands only the first exercise of an existing note", () => {
    const draft = toDraft(saved, "2026-11-26");

    expect(draft.items.map((item) => item.open)).toEqual([true, false]);
  });

  it("expands only the exercise at the given index", () => {
    const draft = toDraft(saved, "2026-11-26", 1);

    expect(draft.items.map((item) => item.open)).toEqual([false, true]);
  });

  it("falls back to the first exercise for an out-of-range index", () => {
    expect(
      toDraft(saved, "2026-11-26", 5).items.map((item) => item.open),
    ).toEqual([true, false]);
    expect(
      toDraft(saved, "2026-11-26", -1).items.map((item) => item.open),
    ).toEqual([true, false]);
  });

  it("shows kg with a comma and keeps the unit and note", () => {
    const [squat, plank] = toDraft(saved, "2026-11-26").items;

    expect(squat.sets.map((s) => [s.kg, s.value, s.unit, s.note])).toEqual([
      ["62,5", "10", "reps", ""],
      ["90", "5", "reps", "Hơi đau vai"],
    ]);
    expect(plank.sets[0]).toMatchObject({
      kg: "",
      value: "45",
      unit: "seconds",
    });
  });

  it("gives every item and set a distinct key", () => {
    const draft = toDraft(saved, "2026-11-26");
    const keys = draft.items.flatMap((item) => [
      item.key,
      ...item.sets.map((set) => set.key),
    ]);

    expect(new Set(keys).size).toBe(keys.length);
    expect(getNextKey(draft)).toBe(Math.max(...keys) + 1);
  });

  it("gives an exercise without sets one empty set", () => {
    const draft = toDraft(
      { ...saved, items: [{ ...saved.items[0], sets: [] }] },
      "2026-11-26",
    );

    expect(draft.items[0].sets).toHaveLength(1);
    expect(draft.items[0].sets[0]).toMatchObject({ kg: "", value: "" });
  });
});

describe("toInput", () => {
  it("round-trips a saved note through the draft and the schema", () => {
    const parsed = trainingNoteSchema.parse(
      toInput(toDraft(saved, "2026-11-26"), saved.id),
    );

    expect(parsed.id).toBe(7);
    expect(parsed.items).toEqual([
      {
        exerciseName: "Squat",
        exerciseRef: null,
        sets: [
          {
            unit: "reps",
            reps: 10,
            durationSec: null,
            weightKg: 62.5,
            note: null,
          },
          {
            unit: "reps",
            reps: 5,
            durationSec: null,
            weightKg: 90,
            note: "Hơi đau vai",
          },
        ],
      },
      {
        exerciseName: "Plank",
        exerciseRef: null,
        sets: [
          {
            unit: "seconds",
            reps: null,
            durationSec: 45,
            weightKg: null,
            note: null,
          },
        ],
      },
    ]);
  });

  it("reads a comma decimal and puts the value in the unit's field", () => {
    const draft = toDraft(null, "2026-11-26");

    draft.items[0].name = "Squat";
    draft.items[0].sets[0] = {
      ...draft.items[0].sets[0],
      kg: " 82,5 ",
      value: "40",
      unit: "seconds",
    };
    expect(toInput(draft).items[0].sets[0]).toMatchObject({
      unit: "seconds",
      reps: null,
      durationSec: 40,
      weightKg: 82.5,
    });
  });

  it("passes a wrong value on as NaN so the server reports it", () => {
    const draft = toDraft(null, "2026-11-26");

    draft.items[0].sets[0].value = "abc";
    expect(toInput(draft).items[0].sets[0].reps).toBeNaN();
  });
});

describe("createSetFrom", () => {
  it("copies kg, value and unit but not the note", () => {
    const [squat] = toDraft(saved, "2026-11-26").items;
    const copy = createSetFrom(squat.sets[1], 99);

    expect(copy).toEqual({
      key: 99,
      kg: "90",
      value: "5",
      unit: "reps",
      note: "",
      noteOpen: false,
    });
  });
});

describe("summarizeItem", () => {
  const [squat, plank] = toDraft(saved, "2026-11-26").items;

  it("summarizes the kg range of a weighted exercise", () => {
    expect(summarizeItem(squat)).toEqual({
      sets: 2,
      kg: { min: 62.5, max: 90 },
      value: { kind: "reps", min: 5, max: 10 },
    });
  });

  it("summarizes seconds when there is no weight", () => {
    expect(summarizeItem(plank)).toEqual({
      sets: 1,
      kg: null,
      value: { kind: "seconds", min: 45, max: 45 },
    });
  });

  it("reports mixed units and ignores blank sets", () => {
    const item = {
      ...plank,
      sets: [
        plank.sets[0],
        { ...plank.sets[0], key: 50, unit: "reps" as const },
        { ...plank.sets[0], key: 51, value: "" },
      ],
    };

    expect(summarizeItem(item).value).toEqual({ kind: "mixed" });
    // The blank third set is not counted.
    expect(summarizeItem(item).sets).toBe(2);
  });
});

describe("moveItem", () => {
  const make = (key: number): ItemDraft => ({
    key,
    name: `Bài ${key}`,
    ref: null,
    muscles: null,
    open: true,
    sets: [],
  });
  const items = [make(10), make(11), make(12)];
  const keys = (list: ItemDraft[]) => list.map((item) => item.key);

  it("moves an item up", () => {
    expect(keys(moveItem(items, 12, 1))).toEqual([10, 12, 11]);
  });

  it("moves an item down", () => {
    expect(keys(moveItem(items, 10, 2))).toEqual([11, 12, 10]);
  });

  it("moves the last item to the very top", () => {
    expect(keys(moveItem(items, 12, 0))).toEqual([12, 10, 11]);
  });

  it("clamps an out-of-range index", () => {
    expect(keys(moveItem(items, 11, 99))).toEqual([10, 12, 11]);
    expect(keys(moveItem(items, 11, -5))).toEqual([11, 10, 12]);
  });

  it("ignores a non-finite index", () => {
    expect(moveItem(items, 11, Number.NaN)).toBe(items);
  });

  it("returns the same list for an unknown key", () => {
    expect(moveItem(items, 99, 0)).toBe(items);
  });

  it("returns the same list when the item does not move", () => {
    expect(moveItem(items, 11, 1)).toBe(items);
    expect(moveItem(items, 10, -1)).toBe(items);
  });

  it("does not mutate the input and keeps item objects", () => {
    const moved = moveItem(items, 10, 2);

    expect(keys(items)).toEqual([10, 11, 12]);
    expect(moved[2]).toBe(items[0]);
  });
});
