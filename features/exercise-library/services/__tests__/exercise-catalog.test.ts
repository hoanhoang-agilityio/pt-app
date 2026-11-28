import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { CATALOG, findCatalogExercise } =
  await import("@/features/exercise-library/services/exercise-catalog");
const { isMuscleKey } =
  await import("@/features/exercise-library/utils/muscles");
const { parseExerciseRef } =
  await import("@/features/exercise-library/utils/exercise-ref");

describe("catalog", () => {
  it("holds the 876 exercises of free-exercise-db with unique ids", () => {
    expect(CATALOG).toHaveLength(876);
    expect(new Set(CATALOG.map((entry) => entry.id)).size).toBe(876);
  });

  it("only uses known muscle keys", () => {
    const keys = CATALOG.flatMap((entry) => [
      ...entry.primary,
      ...entry.secondary,
    ]);

    expect(keys.every(isMuscleKey)).toBe(true);
  });

  it("lists each muscle once, primary or secondary", () => {
    const bad = CATALOG.filter(
      (entry) =>
        new Set([...entry.primary, ...entry.secondary]).size !==
        entry.primary.length + entry.secondary.length,
    );

    expect(bad.map((entry) => entry.id)).toEqual([]);
  });

  it("has an id that forms a valid built-in ref", () => {
    const bad = CATALOG.filter(
      (entry) => parseExerciseRef(`b:${entry.id}`)?.kind !== "builtin",
    );

    expect(bad.map((entry) => entry.id)).toEqual([]);
  });

  it("finds an exercise by id and not a made-up one", () => {
    expect(findCatalogExercise("3_4_Sit-Up")).toMatchObject({
      name: "3/4 Sit-Up",
      primary: ["abdominals"],
      nameKey: "3/4 sit-up",
    });
    expect(findCatalogExercise("nope")).toBeUndefined();
  });
});
