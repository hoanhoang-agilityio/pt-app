import { useState } from "react";

import {
  hexToHsl,
  hexToRgb,
  type Hsl,
  hslToHex,
  normalizeHex,
  type Rgb,
  rgbToHex,
} from "@/features/theme/utils/color";

interface Draft {
  hex: string;
  // Kept next to the hex so dragging the HSL sliders does not lose hue and
  // saturation when the color passes through a gray or a rounded hex.
  hsl: Hsl;
}

const fromHex = (hex: string): Draft => ({ hex, hsl: hexToHsl(hex) });

// The color being edited in the picker. One source of truth (hex plus the hsl
// that goes with it); the native input, HEX field, RGB and HSL sliders and the
// swatches all write through these setters.
export const useColorDraft = (initialHex: string) => {
  const [draft, setDraft] = useState<Draft>(() => fromHex(initialHex));

  const setHex = (value: string) => {
    const hex = normalizeHex(value);

    if (hex) {
      setDraft(fromHex(hex));
    }
  };

  const setRgb = (rgb: Rgb) => setDraft(fromHex(rgbToHex(rgb)));

  const setHsl = (hsl: Hsl) => setDraft({ hex: hslToHex(hsl), hsl });

  return {
    hex: draft.hex,
    rgb: hexToRgb(draft.hex),
    hsl: draft.hsl,
    setHex,
    setRgb,
    setHsl,
  };
};
