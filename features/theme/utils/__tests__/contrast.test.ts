import { describe, expect, it } from "vitest";

import {
  DARK_BACKGROUNDS,
  LIGHT_BACKGROUNDS,
  PRESET_COLORS,
} from "@/features/theme/constants/theme";

import { hexToHsl } from "../color";
import {
  contrastRatio,
  deriveDarkVariant,
  fixForLightMode,
  fixLightness,
  getContrastReport,
  pickForeground,
  relativeLuminance,
} from "../contrast";

const worst = (color: string, backgrounds: readonly string[]) =>
  Math.min(...backgrounds.map((bg) => contrastRatio(color, bg)));

describe("luminance and contrast", () => {
  it("anchors black and white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 10);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  it("is symmetric and matches a known pair", () => {
    // #767676 on white is the classic 4.54:1 gray.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#ffffff", "#767676")).toBe(
      contrastRatio("#767676", "#ffffff"),
    );
  });
});

describe("pickForeground", () => {
  it("picks black on light colors and white on dark colors", () => {
    expect(pickForeground("#ffe066")).toBe("#000000");
    expect(pickForeground("#ffffff")).toBe("#000000");
    expect(pickForeground("#1e3a8a")).toBe("#ffffff");
    expect(pickForeground("#000000")).toBe("#ffffff");
  });

  it("always reaches 4.5:1 for a sweep of colors", () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

          expect(
            contrastRatio(hex, pickForeground(hex)),
            hex,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

describe("fixLightness", () => {
  it("returns a passing color unchanged", () => {
    expect(fixLightness("#1e3a8a", LIGHT_BACKGROUNDS, 3)).toBe("#1e3a8a");
  });

  it("darkens a pale color to 3:1 on both light surfaces, keeping the hue", () => {
    const fixed = fixLightness("#ffe066", LIGHT_BACKGROUNDS, 3);

    expect(worst(fixed, LIGHT_BACKGROUNDS)).toBeGreaterThanOrEqual(3);
    expect(hexToHsl(fixed).h).toBeCloseTo(hexToHsl("#ffe066").h, 0);
    expect(hexToHsl(fixed).l).toBeLessThan(hexToHsl("#ffe066").l);
    // Nearest: one step lighter would no longer pass.
    expect(hexToHsl(fixed).l).toBeGreaterThan(30);
  });

  it("lightens a dark color on a dark background", () => {
    const fixed = fixLightness("#1e3a8a", DARK_BACKGROUNDS, 3);

    expect(worst(fixed, DARK_BACKGROUNDS)).toBeGreaterThanOrEqual(3);
    expect(hexToHsl(fixed).l).toBeGreaterThan(hexToHsl("#1e3a8a").l);
  });

  it("rejects an invalid color", () => {
    expect(() => fixLightness("nope", LIGHT_BACKGROUNDS, 3)).toThrow();
  });
});

describe("deriveDarkVariant", () => {
  it("passes 3:1 on both dark surfaces for every preset and edge colors", () => {
    for (const hex of [
      ...PRESET_COLORS,
      "#000000",
      "#0a0a0a",
      "#1e3a8a",
      "#ffffff",
    ]) {
      expect(
        worst(deriveDarkVariant(hex), DARK_BACKGROUNDS),
        hex,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("lightens the default orange like the hand-made dark token", () => {
    const dark = deriveDarkVariant("#e8590c");

    expect(hexToHsl(dark).l).toBeGreaterThanOrEqual(55);
    expect(hexToHsl(dark).h).toBeCloseTo(21, 0);
  });

  it("keeps an already bright color as it is", () => {
    expect(deriveDarkVariant("#ff7a2e")).toBe("#ff7a2e");
  });
});

describe("getContrastReport", () => {
  it("passes for a mid blue", () => {
    const report = getContrastReport("#2563eb");

    expect(report.foreground).toBe("#ffffff");
    expect(report.isOk).toBe(true);
    expect(report.darkRatio).toBeGreaterThanOrEqual(3);
  });

  it("warns about a pale color and the fix passes", () => {
    const report = getContrastReport("#ffe066");

    expect(report.isForegroundOk).toBe(true);
    expect(report.isBackgroundOk).toBe(false);
    expect(report.lightRatio).toBeLessThan(3);
    expect(getContrastReport(fixForLightMode("#ffe066")).isOk).toBe(true);
  });
});
