export interface Rgb {
  r: number;
  g: number;
  b: number;
}

// h in degrees [0, 360), s and l in percent [0, 100].
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// "#rgb" or "#rrggbb" in any case -> "#rrggbb"; anything else -> null. Every
// color that reaches the page or the database goes through here first.
export const normalizeHex = (input: unknown): string | null => {
  if (typeof input !== "string") {
    return null;
  }
  const value = input.trim();

  if (!HEX_PATTERN.test(value)) {
    return null;
  }
  const digits = value.slice(1).toLowerCase();
  const full =
    digits.length === 3
      ? [...digits].map((digit) => digit + digit).join("")
      : digits;

  return `#${full}`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const channelToHex = (value: number) =>
  clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");

export const hexToRgb = (hex: string): Rgb => {
  const normalized = normalizeHex(hex);

  if (!normalized) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

export const rgbToHex = ({ r, g, b }: Rgb) =>
  `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;

export const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness * 100 };
  }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;

  if (max === red) {
    hue = ((green - blue) / delta) % 6;
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }
  return {
    h: (hue * 60 + 360) % 360,
    s: saturation * 100,
    l: lightness * 100,
  };
};

export const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const hue = ((h % 360) + 360) % 360;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const sector = Math.floor(hue / 60);
  const [r, g, b] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ][sector % 6];

  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
};

export const hexToHsl = (hex: string): Hsl => rgbToHsl(hexToRgb(hex));

export const hslToHex = (hsl: Hsl) => rgbToHex(hslToRgb(hsl));
