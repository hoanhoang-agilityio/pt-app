import { describe, expect, it } from "vitest";

import {
  hexToHsl,
  hexToRgb,
  hslToHex,
  hslToRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsl,
} from "../color";

describe("normalizeHex", () => {
  it("expands #rgb and lower-cases", () => {
    expect(normalizeHex("#F60")).toBe("#ff6600");
    expect(normalizeHex("#E8590C")).toBe("#e8590c");
    expect(normalizeHex("  #AbCdEf ")).toBe("#abcdef");
  });

  it.each([
    "e8590c",
    "#e8590",
    "#e8590cc",
    "#ff66",
    "#gggggg",
    "red",
    "rgb(1,2,3)",
    "#e8590c;}body{display:none",
    "",
  ])("rejects %j", (input) => {
    expect(normalizeHex(input)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
    expect(normalizeHex(0xe8590c)).toBeNull();
  });
});

describe("conversions", () => {
  it("reads rgb from hex", () => {
    expect(hexToRgb("#e8590c")).toEqual({ r: 232, g: 89, b: 12 });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("writes hex from rgb and clamps", () => {
    expect(rgbToHex({ r: 232, g: 89, b: 12 })).toBe("#e8590c");
    expect(rgbToHex({ r: 300, g: -5, b: 127.6 })).toBe("#ff0080");
  });

  it("converts the default orange to hsl", () => {
    const hsl = hexToHsl("#e8590c");

    expect(hsl.h).toBeCloseTo(21, 5);
    expect(hsl.s).toBeCloseTo(90.16, 1);
    expect(hsl.l).toBeCloseTo(47.84, 1);
  });

  it("converts primaries and grays", () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
    expect(hexToHsl("#808080").s).toBe(0);
    expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe("#00ff00");
    expect(hslToHex({ h: 0, s: 0, l: 100 })).toBe("#ffffff");
    expect(hslToRgb({ h: 360, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("round-trips every preset-like color through hsl", () => {
    for (const hex of ["#e8590c", "#2563eb", "#7c3aed", "#15803d", "#ca8a04"]) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });
});
