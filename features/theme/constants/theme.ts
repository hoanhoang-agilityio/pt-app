// Page backgrounds the accent has to stand out from (app/globals.css).
export const LIGHT_BACKGROUNDS = ["#f4f4f5", "#ffffff"] as const;
export const DARK_BACKGROUNDS = ["#0c0c0e", "#18181b"] as const;

// WCAG: text on the accent, and the accent as a UI component on the page.
export const MIN_TEXT_RATIO = 4.5;
export const MIN_UI_RATIO = 3;

// The dark variant is never darker than this lightness, so it reads as the
// brighter sibling of the light color (like #e8590c -> #ff7a2e).
export const DARK_MIN_LIGHTNESS = 55;

export const FOREGROUND_LIGHT = "#ffffff";
export const FOREGROUND_DARK = "#000000";

export const THEME_SCOPES = ["self", "trainee", "pt", "all"] as const;
export type ThemeScope = (typeof THEME_SCOPES)[number];

// Scopes stored in theme_settings; "self" lives on admins.accent_color.
export type StoredScope = Exclude<ThemeScope, "self">;

export const THEME_CACHE_TAG = "theme-settings";

export const DEFAULT_ACCENT = "#e8590c";

export const PRESET_COLORS = [
  "#e8590c",
  "#dc2626",
  "#db2777",
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#15803d",
  "#ca8a04",
] as const;

export const THEME_MESSAGES = {
  INVALID_COLOR: "Màu không hợp lệ",
  INVALID_SCOPE: "Phạm vi không hợp lệ",
} as const;
