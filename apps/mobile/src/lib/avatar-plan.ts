import {
  AVATAR_MAX_DATA_URL_LENGTH,
  AVATAR_SIZE_PX,
  type ChatColorKey,
} from "@pt/contracts";

// Profile photo rules: the API takes a JSON data URL of a 256x256 image of at
// most 80 KB (apps/api avatar.service). Pure helpers, unit-tested.

export const AVATAR_SIDE = AVATAR_SIZE_PX;
// JPEG quality steps tried until the data URL fits.
export const AVATAR_QUALITIES = [0.8, 0.6, 0.4, 0.25] as const;

export const toDataUrl = (base64: string, mime = "image/jpeg") =>
  `data:${mime};base64,${base64}`;

export const fitsAvatar = (dataUrl: string) =>
  dataUrl.length <= AVATAR_MAX_DATA_URL_LENGTH;

// The first quality whose encoded result fits, or null when none does.
export const pickAvatarQuality = (
  encode: (quality: number) => string,
): { quality: number; dataUrl: string } | null => {
  for (const quality of AVATAR_QUALITIES) {
    const dataUrl = encode(quality);

    if (fitsAvatar(dataUrl)) {
      return { quality, dataUrl };
    }
  }
  return null;
};

// Bubble colours of the chat palette (hex values as the web's chat-palette).
export const CHAT_COLORS: Record<ChatColorKey, string> = {
  orange: "#c2410c",
  red: "#b91c1c",
  pink: "#be185d",
  purple: "#7e22ce",
  indigo: "#4338ca",
  blue: "#1d4ed8",
  teal: "#0f766e",
  green: "#15803d",
};
