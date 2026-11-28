import { describe, expect, it } from "vitest";

import { EXERCISE_MESSAGES as MESSAGES } from "@/features/exercise-library/constants/messages";
import {
  exerciseInputSchema,
  searchInputSchema,
} from "@/features/exercise-library/services/exercise-schemas";

describe("exerciseInputSchema", () => {
  it("trims, nulls blanks and keeps muscles", () => {
    const result = exerciseInputSchema.parse({
      name: "  Kéo xà  ",
      primary: ["lats"],
      secondary: ["biceps"],
      equipment: "  ",
      instructions: "Bước 1\nBước 2",
    });

    expect(result).toEqual({
      name: "Kéo xà",
      primary: ["lats"],
      secondary: ["biceps"],
      equipment: null,
      instructions: "Bước 1\nBước 2",
    });
  });

  it("drops duplicates and a secondary muscle that is also primary", () => {
    const result = exerciseInputSchema.parse({
      name: "Squat",
      primary: ["quadriceps", "quadriceps"],
      secondary: ["quadriceps", "glutes", "glutes"],
    });

    expect(result.primary).toEqual(["quadriceps"]);
    expect(result.secondary).toEqual(["glutes"]);
  });

  it("tells keep (undefined) from remove (null) for the photo", () => {
    expect(exerciseInputSchema.parse({ name: "A" }).photo).toBeUndefined();
    expect(
      exerciseInputSchema.parse({ name: "A", photo: null }).photo,
    ).toBeNull();
  });

  it.each([
    [{ name: "   " }, MESSAGES.NAME_REQUIRED],
    [{ name: "a".repeat(81) }, MESSAGES.NAME_TOO_LONG],
    [{ name: "A", equipment: "e".repeat(41) }, MESSAGES.EQUIPMENT_TOO_LONG],
    [
      { name: "A", instructions: "i".repeat(2001) },
      MESSAGES.INSTRUCTIONS_TOO_LONG,
    ],
    [{ name: "A", primary: ["lower back"] }, MESSAGES.MUSCLE_INVALID],
  ])("rejects %j with the specific message", (input, message) => {
    const result = exerciseInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("searchInputSchema", () => {
  it("fills the defaults", () => {
    expect(searchInputSchema.parse({})).toEqual({
      q: "",
      filters: { muscles: [], equipment: [], levels: [], categories: [] },
      source: "all",
      limit: 30,
    });
  });

  it("keeps known keys and fills the groups left out", () => {
    expect(
      searchInputSchema.parse({
        filters: { muscles: ["chest", "triceps"], levels: ["expert"] },
      }).filters,
    ).toEqual({
      muscles: ["chest", "triceps"],
      equipment: [],
      levels: ["expert"],
      categories: [],
    });
  });

  it("drops duplicate keys", () => {
    expect(
      searchInputSchema.parse({
        filters: {
          muscles: ["chest", "lats", "chest"],
          equipment: ["body_only", "body_only"],
        },
      }).filters,
    ).toMatchObject({ muscles: ["chest", "lats"], equipment: ["body_only"] });
  });

  it.each([
    { limit: 0 },
    { limit: 101 },
    { source: "x" },
    { filters: { muscles: ["wings"] } },
    { filters: { equipment: ["body only"] } },
    { filters: { levels: ["god"] } },
    { filters: { categories: ["yoga"] } },
    { filters: { muscles: "chest" } },
    { filters: { muscles: Array(18).fill("chest") } },
    { filters: { levels: ["beginner", "beginner", "beginner", "beginner"] } },
  ])("rejects %j", (input) => {
    expect(searchInputSchema.safeParse(input).success).toBe(false);
  });
});
