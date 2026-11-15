import { normalizeHex } from "./color";

export interface AccentLayers {
  self?: string | null;
  role?: string | null;
  all?: string | null;
  // The viewer's role is locked: the personal color is ignored (but kept in
  // the database). Never pass true for the super admin.
  locked?: boolean;
}

// Unlocked: personal > role color > "all" color > null (the default orange).
// Locked: the personal layer is skipped. A layer whose value fails
// normalization is skipped, never trusted.
export const resolveAccent = ({ self, role, all, locked }: AccentLayers) => {
  for (const layer of [locked ? null : self, role, all]) {
    const hex = normalizeHex(layer);

    if (hex) {
      return hex;
    }
  }
  return null;
};
