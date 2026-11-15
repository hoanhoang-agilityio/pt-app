import {
  DARK_BACKGROUNDS,
  DARK_MIN_LIGHTNESS,
  FOREGROUND_DARK,
  FOREGROUND_LIGHT,
  LIGHT_BACKGROUNDS,
  MIN_TEXT_RATIO,
  MIN_UI_RATIO,
} from "@/features/theme/constants/theme";

import { hexToHsl, hexToRgb, hslToHex, normalizeHex } from "./color";

const linear = (channel: number) => {
  const value = channel / 255;

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

// WCAG 2.x relative luminance, 0 (black) to 1 (white).
export const relativeLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);

  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

// WCAG contrast ratio, 1 to 21.
export const contrastRatio = (first: string, second: string) => {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// Text color on the accent: white or black, whichever contrasts more. The
// better of the two is always at least 4.58:1, so it meets 4.5:1.
export const pickForeground = (accent: string) =>
  contrastRatio(accent, FOREGROUND_LIGHT) >=
  contrastRatio(accent, FOREGROUND_DARK)
    ? FOREGROUND_LIGHT
    : FOREGROUND_DARK;

const minRatioAgainst = (color: string, backgrounds: readonly string[]) =>
  Math.min(
    ...backgrounds.map((background) => contrastRatio(color, background)),
  );

const LIGHTNESS_STEP = 0.25;

// Changes only the HSL lightness (hue and saturation stay) to the value
// nearest to the current one where `color` reaches `minRatio` against every
// background. A color that already passes is returned as it is. When no
// lightness can pass, the best one found is returned.
export const fixLightness = (
  color: string,
  backgrounds: readonly string[],
  minRatio: number,
) => {
  const hex = normalizeHex(color);

  if (!hex) {
    throw new Error(`Invalid hex color: ${color}`);
  }
  if (minRatioAgainst(hex, backgrounds) >= minRatio) {
    return hex;
  }
  const hsl = hexToHsl(hex);
  let best = hex;
  let bestRatio = minRatioAgainst(hex, backgrounds);
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let lightness = 0; lightness <= 100; lightness += LIGHTNESS_STEP) {
    const candidate = hslToHex({ ...hsl, l: lightness });
    const ratio = minRatioAgainst(candidate, backgrounds);
    const distance = Math.abs(lightness - hsl.l);

    if (ratio >= minRatio) {
      if (bestRatio < minRatio || distance < bestDistance) {
        best = candidate;
        bestRatio = ratio;
        bestDistance = distance;
      }
    } else if (bestRatio < minRatio && ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
};

// The dark-mode accent: never darker than DARK_MIN_LIGHTNESS and always
// readable (3:1) on both dark surfaces.
export const deriveDarkVariant = (accent: string) => {
  const hex = normalizeHex(accent);

  if (!hex) {
    throw new Error(`Invalid hex color: ${accent}`);
  }
  const hsl = hexToHsl(hex);
  const lifted = hslToHex({ ...hsl, l: Math.max(hsl.l, DARK_MIN_LIGHTNESS) });

  return fixLightness(lifted, DARK_BACKGROUNDS, MIN_UI_RATIO);
};

export interface ContrastReport {
  // The text color on the accent and its ratio (needs 4.5).
  foreground: string;
  foregroundRatio: number;
  // Worst ratio of the accent against the light page and card (needs 3).
  lightRatio: number;
  // The derived dark variant and its worst ratio on the dark surfaces.
  darkAccent: string;
  darkRatio: number;
  isForegroundOk: boolean;
  isBackgroundOk: boolean;
  isOk: boolean;
}

export const getContrastReport = (accent: string): ContrastReport => {
  const hex = normalizeHex(accent);

  if (!hex) {
    throw new Error(`Invalid hex color: ${accent}`);
  }
  const foreground = pickForeground(hex);
  const foregroundRatio = contrastRatio(hex, foreground);
  const lightRatio = minRatioAgainst(hex, LIGHT_BACKGROUNDS);
  const darkAccent = deriveDarkVariant(hex);
  const darkRatio = minRatioAgainst(darkAccent, DARK_BACKGROUNDS);
  const isForegroundOk = foregroundRatio >= MIN_TEXT_RATIO;
  const isBackgroundOk = lightRatio >= MIN_UI_RATIO;

  return {
    foreground,
    foregroundRatio,
    lightRatio,
    darkAccent,
    darkRatio,
    isForegroundOk,
    isBackgroundOk,
    isOk: isForegroundOk && isBackgroundOk,
  };
};

// "Fix lightness" button: the nearest light-mode color that passes.
export const fixForLightMode = (accent: string) =>
  fixLightness(accent, LIGHT_BACKGROUNDS, MIN_UI_RATIO);
