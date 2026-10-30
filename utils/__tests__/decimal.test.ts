import { describe, expect, it } from "vitest";

import { parseDecimal, parseSignedDecimal } from "@/utils/decimal";

describe("parseDecimal", () => {
  it("reads plain decimals with a point or a comma", () => {
    expect(parseDecimal("42")).toBe(42);
    expect(parseDecimal("42.5")).toBe(42.5);
    expect(parseDecimal("42,5")).toBe(42.5);
    expect(parseDecimal(",5")).toBe(0.5);
    expect(parseDecimal("5,")).toBe(5);
    expect(parseDecimal("  3,6 ")).toBe(3.6);
  });

  it("gives NaN for anything else", () => {
    for (const text of [
      "",
      " ",
      "abc",
      "1e2",
      "0x14",
      "-1",
      "1,2,3",
      "1.2.3",
      "Infinity",
    ]) {
      expect(parseDecimal(text)).toBeNaN();
    }
  });
});

describe("parseSignedDecimal", () => {
  it("reads an optional leading sign", () => {
    expect(parseSignedDecimal("-200")).toBe(-200);
    expect(parseSignedDecimal("−200")).toBe(-200);
    expect(parseSignedDecimal("+200")).toBe(200);
    expect(parseSignedDecimal(" 0 ")).toBe(0);
    expect(parseSignedDecimal("-1,5")).toBe(-1.5);
    expect(Object.is(parseSignedDecimal("-0"), 0)).toBe(true);
  });

  it("gives NaN for anything else", () => {
    for (const text of ["", "-", "+-1", "--1", "1-", "-1e2", "abc"]) {
      expect(parseSignedDecimal(text)).toBeNaN();
    }
  });
});
