import { describe, expect, it } from "vitest";

import {
  formatExerciseRef,
  parseExerciseRef,
} from "@/features/exercise-library/utils/exercise-ref";

describe("parseExerciseRef", () => {
  it("reads a built-in ref", () => {
    expect(parseExerciseRef("b:3_4_Sit-Up")).toEqual({
      kind: "builtin",
      id: "3_4_Sit-Up",
    });
  });

  it("reads a custom ref as a number", () => {
    expect(parseExerciseRef("c:42")).toEqual({ kind: "custom", id: 42 });
  });

  it.each([
    null,
    undefined,
    42,
    "",
    "b:",
    "c:",
    "c:0",
    "c:-1",
    "c:1.5",
    "c:abc",
    "c:01",
    "x:1",
    "b:a b",
    "b:../etc",
    "42",
    `b:${"a".repeat(101)}`,
  ])("rejects %j", (value) => {
    expect(parseExerciseRef(value)).toBeNull();
  });

  it("round-trips through formatExerciseRef", () => {
    expect(formatExerciseRef("custom", 7)).toBe("c:7");
    expect(formatExerciseRef("builtin", "Squat")).toBe("b:Squat");
    expect(parseExerciseRef(formatExerciseRef("custom", 7))).toEqual({
      kind: "custom",
      id: 7,
    });
  });
});
