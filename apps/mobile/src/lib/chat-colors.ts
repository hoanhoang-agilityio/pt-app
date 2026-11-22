import { CHAT_COLOR_KEYS, type ChatColorKey } from "@pt/contracts";

// Bubble colours: accounts and conversations store the key, never the hex.
// Values mirror apps/web/features/chat/utils/chat-palette.ts (white text on
// each passes WCAG AA).

export const CHAT_PALETTE: Record<ChatColorKey, string> = {
  orange: "#c2410c",
  red: "#b91c1c",
  pink: "#be185d",
  purple: "#7e22ce",
  indigo: "#4338ca",
  blue: "#1d4ed8",
  teal: "#0f766e",
  green: "#15803d",
};

export const DEFAULT_CHAT_COLOR: ChatColorKey = "orange";
export const CHAT_TEXT_ON_COLOR = "#ffffff";
export const chatColorKeys = CHAT_COLOR_KEYS;

export const isChatColorKey = (value: unknown): value is ChatColorKey =>
  typeof value === "string" && (CHAT_COLOR_KEYS as readonly string[]).includes(value);

// Unknown or missing keys fall back to the default colour.
export const chatColorHex = (key: string | null | undefined) =>
  CHAT_PALETTE[isChatColorKey(key) ? key : DEFAULT_CHAT_COLOR];

// Own bubble colour: the conversation colour first, then the account colour.
export const ownBubbleColor = (
  colors: Record<string, string> | undefined,
  ownKey: string,
  accountColor: string | null | undefined,
) => ({
  bg: chatColorHex(colors?.[ownKey] ?? accountColor),
  fg: CHAT_TEXT_ON_COLOR,
});
