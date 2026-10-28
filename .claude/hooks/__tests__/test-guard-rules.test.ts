import { describe, expect, it } from "vitest";

import { findTestEditViolation } from "../test-guard-rules.mjs";

describe("findTestEditViolation", () => {
  it.each([
    "/home/claude/pt-app/utils/__tests__/x.test.ts",
    "utils/__tests__/helpers.ts",
    "features/workouts/utils/format.test.ts",
    "components/Button/index.test.tsx",
    "services/session.spec.ts",
    "components/Button/index.spec.tsx",
    "e2e/set-logging.ts",
    "/home/claude/pt-app/e2e/specs/login.ts",
    "C:\\work\\pt-app\\utils\\__tests__\\x.ts",
    "C:\\work\\pt-app\\e2e\\login.ts",
  ])("blocks %s in fix mode", (filePath) => {
    expect(findTestEditViolation(filePath, { fixMode: true })).toEqual(
      expect.any(String),
    );
  });

  it.each([
    "utils/format.ts",
    "features/workouts/components/Card/index.tsx",
    "services/test-helpers-not.ts",
    "docs/specs/set-logging.md",
    "app/latest.ts",
    "C:\\work\\pt-app\\utils\\format.ts",
    ".claude/hooks/test-guard.mjs",
  ])("allows %s in fix mode", (filePath) => {
    expect(findTestEditViolation(filePath, { fixMode: true })).toBeNull();
  });

  it("allows test files when fix mode is off", () => {
    expect(
      findTestEditViolation("utils/__tests__/x.test.ts", { fixMode: false }),
    ).toBeNull();
    expect(findTestEditViolation("utils/__tests__/x.test.ts")).toBeNull();
  });

  it("allows a missing path", () => {
    expect(findTestEditViolation(undefined, { fixMode: true })).toBeNull();
  });

  it("tells Claude how to proceed", () => {
    expect(
      findTestEditViolation("a/__tests__/b.test.ts", { fixMode: true }),
    ).toMatch(/Fix the code, not the test.*\.claude\/fix-mode/);
  });
});
