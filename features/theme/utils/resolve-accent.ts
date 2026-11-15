import { normalizeHex } from "./color";

export interface AccentLayers {
  self?: string | null;
  role?: string | null;
  all?: string | null;
}

// self override > role color > "all" color > null (the default orange). A
// layer whose value fails normalization is skipped, never trusted.
export const resolveAccent = ({ self, role, all }: AccentLayers) => {
  for (const layer of [self, role, all]) {
    const hex = normalizeHex(layer);

    if (hex) {
      return hex;
    }
  }
  return null;
};
