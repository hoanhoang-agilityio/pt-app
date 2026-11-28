import { describe, expect, it } from "vitest";

import {
  BACK_SHAPES,
  FRONT_SHAPES,
} from "@/features/exercise-library/constants/muscle-paths";
import { MUSCLE_KEYS } from "@/features/exercise-library/constants/muscles";
import {
  fromCatalogMuscle,
  isMuscleKey,
  parseMuscleColumn,
  splitMuscles,
} from "@/features/exercise-library/utils/muscles";

describe("fromCatalogMuscle", () => {
  it("maps the two names with a space to snake_case keys", () => {
    expect(fromCatalogMuscle("lower back")).toBe("lower_back");
    expect(fromCatalogMuscle("middle back")).toBe("middle_back");
  });

  it("keeps the other names and rejects unknown ones", () => {
    expect(fromCatalogMuscle("quadriceps")).toBe("quadriceps");
    expect(fromCatalogMuscle("wings")).toBeNull();
    expect(fromCatalogMuscle("lower_back_x")).toBeNull();
  });
});

describe("muscle keys", () => {
  it("has the 17 groups of the catalog", () => {
    expect(MUSCLE_KEYS).toHaveLength(17);
    expect(isMuscleKey("lower_back")).toBe(true);
    expect(isMuscleKey("lower back")).toBe(false);
  });

  it("has a diagram polygon for every key on at least one side", () => {
    const drawn = new Set(
      [...FRONT_SHAPES, ...BACK_SHAPES].flatMap((shape) => shape.muscles ?? []),
    );

    expect([...MUSCLE_KEYS].filter((key) => !drawn.has(key))).toEqual([]);
  });
});

describe("parseMuscleColumn", () => {
  it("drops unknown keys and duplicates", () => {
    expect(parseMuscleColumn('["chest","wings","chest","triceps"]')).toEqual([
      "chest",
      "triceps",
    ]);
  });

  it("reads broken or empty values as no muscles", () => {
    expect(parseMuscleColumn("not json")).toEqual([]);
    expect(parseMuscleColumn('{"a":1}')).toEqual([]);
    expect(parseMuscleColumn(null)).toEqual([]);
  });
});

describe("splitMuscles", () => {
  it("keeps a muscle in the primary list only", () => {
    expect(splitMuscles(["chest"], ["chest", "triceps", "triceps"])).toEqual({
      primary: ["chest"],
      secondary: ["triceps"],
    });
  });
});
