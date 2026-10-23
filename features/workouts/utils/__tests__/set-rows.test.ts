import { describe, expect, it } from "vitest";

import { groupSetRows } from "@/features/workouts/utils/set-rows";

describe("groupSetRows", () => {
  it("groups rows per exercise, keeping row order and joined fields", () => {
    const groups = groupSetRows([
      { exerciseId: 2, date: "2026-10-20", weightKg: 40, reps: 10 },
      { exerciseId: 1, date: "2026-10-13", weightKg: null, reps: 12 },
      { exerciseId: 2, date: "2026-10-20", weightKg: 42.5, reps: 8 },
    ]);

    expect(groups).toEqual([
      {
        exerciseId: 2,
        date: "2026-10-20",
        sets: [
          { weightKg: 40, reps: 10 },
          { weightKg: 42.5, reps: 8 },
        ],
      },
      {
        exerciseId: 1,
        date: "2026-10-13",
        sets: [{ weightKg: null, reps: 12 }],
      },
    ]);
  });

  it("returns an empty list for no rows", () => {
    expect(groupSetRows([])).toEqual([]);
  });
});
