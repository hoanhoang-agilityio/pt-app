import { useColorScheme } from "react-native";

// "Nhịp Tĩnh": a calm neutral palette with one orange accent. Values mirror
// apps/web/app/globals.css (light and dark).

export type Palette = {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  line: string;
  accent: string;
  accentFg: string;
  bubbleNeutral: string;
  bubbleNeutralFg: string;
  danger: string;
  success: string;
  overlay: string;
};

export const lightPalette: Palette = {
  bg: "#f4f4f5",
  surface: "#ffffff",
  fg: "#111113",
  muted: "#6b6b76",
  line: "#e4e4e9",
  accent: "#e8590c",
  accentFg: "#ffffff",
  bubbleNeutral: "#e4e4e9",
  bubbleNeutralFg: "#111113",
  danger: "#dc2626",
  success: "#15803d",
  overlay: "rgba(0,0,0,0.45)",
};

export const darkPalette: Palette = {
  bg: "#0c0c0e",
  surface: "#18181b",
  fg: "#f4f4f5",
  muted: "#a1a1aa",
  line: "#2a2a30",
  accent: "#ff7a2e",
  accentFg: "#1a0a00",
  bubbleNeutral: "#3f3f46",
  bubbleNeutralFg: "#ffffff",
  danger: "#f87171",
  success: "#4ade80",
  overlay: "rgba(0,0,0,0.6)",
};

export const useTheme = () =>
  useColorScheme() === "dark" ? darkPalette : lightPalette;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
