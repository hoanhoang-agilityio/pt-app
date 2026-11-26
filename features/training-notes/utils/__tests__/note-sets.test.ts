import { describe, expect, it } from "vitest";

import { SETS_PER_ITEM_MAX } from "@/features/training-notes/constants/limits";
import { toItemSets } from "@/features/training-notes/utils/note-sets";

const legacy = (
  overrides: Partial<Parameters<typeof toItemSets>[0]> = {},
): Parameters<typeof toItemSets>[0] => ({
  sets: null,
  reps: null,
  durationSec: null,
  weightKg: null,
  ...overrides,
});

describe("toItemSets", () => {
  it("uses the set rows in position order, ignoring the legacy columns", () => {
    const sets = toItemSets(legacy({ sets: 9, reps: 1, weightKg: 1 }), [
      { position: 1, reps: 8, durationSec: null, weightKg: 80, note: null },
      { position: 0, reps: 10, durationSec: null, weightKg: 60, note: "Chậm" },
      { position: 2, reps: null, durationSec: 45, weightKg: null, note: null },
    ]);

    expect(sets).toEqual([
      {
        position: 0,
        unit: "reps",
        reps: 10,
        durationSec: null,
        weightKg: 60,
        note: "Chậm",
      },
      {
        position: 1,
        unit: "reps",
        reps: 8,
        durationSec: null,
        weightKg: 80,
        note: null,
      },
      {
        position: 2,
        unit: "seconds",
        reps: null,
        durationSec: 45,
        weightKg: null,
        note: null,
      },
    ]);
  });

  it("expands a legacy count into identical sets", () => {
    const sets = toItemSets(legacy({ sets: 4, reps: 8, weightKg: 80 }), []);

    expect(sets).toHaveLength(4);
    expect(sets.map((s) => s.position)).toEqual([0, 1, 2, 3]);
    for (const set of sets) {
      expect(set).toMatchObject({
        unit: "reps",
        reps: 8,
        durationSec: null,
        weightKg: 80,
        note: null,
      });
    }
  });

  it("expands a legacy timed row into timed sets", () => {
    const sets = toItemSets(legacy({ sets: 3, durationSec: 45 }), []);

    expect(sets.map((s) => [s.unit, s.durationSec, s.reps])).toEqual([
      ["seconds", 45, null],
      ["seconds", 45, null],
      ["seconds", 45, null],
    ]);
  });

  it("makes one set from a legacy row without a count", () => {
    expect(toItemSets(legacy({ reps: 12 }), [])).toEqual([
      {
        position: 0,
        unit: "reps",
        reps: 12,
        durationSec: null,
        weightKg: null,
        note: null,
      },
    ]);
    expect(toItemSets(legacy({ weightKg: 20 }), [])).toHaveLength(1);
  });

  it("returns no sets when there is nothing", () => {
    expect(toItemSets(legacy(), [])).toEqual([]);
  });

  it("caps a huge legacy count", () => {
    expect(toItemSets(legacy({ sets: 100000, reps: 5 }), [])).toHaveLength(
      SETS_PER_ITEM_MAX,
    );
  });
});
