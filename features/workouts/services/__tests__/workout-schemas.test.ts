import { describe, expect, it } from "vitest";

import { exerciseSchema } from "@/features/workouts/services/workout-schemas";

const VALID_INPUT = {
  exerciseId: "7",
  userId: "3",
  date: "2026-10-26",
  title: "Squat",
  youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
};

describe("exerciseSchema confirmResetSets", () => {
  it("is false when the field is missing", () => {
    const parsed = exerciseSchema.parse(VALID_INPUT);

    expect(parsed.confirmResetSets).toBe(false);
  });

  it('is true only for the exact value "true"', () => {
    const parsed = exerciseSchema.parse({
      ...VALID_INPUT,
      confirmResetSets: "true",
    });

    expect(parsed.confirmResetSets).toBe(true);
  });

  it.each(["false", "1", "TRUE", ""])("is false for %j", (value) => {
    const parsed = exerciseSchema.parse({
      ...VALID_INPUT,
      confirmResetSets: value,
    });

    expect(parsed.confirmResetSets).toBe(false);
  });

  it("still normalises the link to a video id", () => {
    expect(exerciseSchema.parse(VALID_INPUT).youtubeUrl).toBe("dQw4w9WgXcQ");
  });
});
