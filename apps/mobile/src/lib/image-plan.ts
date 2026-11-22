import {
  CHAT_PHOTO_MAX_BYTES,
  CHAT_PHOTO_MAX_SIDE,
  SOCIAL_POST_MAX_PHOTOS,
} from "@pt/contracts";

// Decides how a picked photo is re-encoded before upload. The API takes raw
// bytes (JPEG, PNG or WebP), at most 1.5 MB and 1600 px on the long side, and
// sniffs the type from the bytes. The app always sends JPEG: it is accepted
// everywhere and drops EXIF (GPS, camera) data.

export const PHOTO_MAX_SIDE = CHAT_PHOTO_MAX_SIDE;
export const PHOTO_MAX_BYTES = CHAT_PHOTO_MAX_BYTES;
// Aim well below the cap so a slow mobile connection uploads quickly.
export const PHOTO_TARGET_BYTES = 400 * 1024;
export const PHOTO_QUALITIES = [0.8, 0.65, 0.5, 0.35] as const;
export const MAX_POST_PHOTOS = SOCIAL_POST_MAX_PHOTOS;

export type ResizeStep = { width: number } | { height: number } | null;

// Which side to fit into the limit: null when the photo already fits.
export const planResize = (
  width: number,
  height: number,
  maxSide: number = PHOTO_MAX_SIDE,
): ResizeStep => {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }
  if (Math.max(width, height) <= maxSide) {
    return null;
  }
  return width >= height ? { width: maxSide } : { height: maxSide };
};

// Pixel size after a resize step (the API refuses a side above the limit).
export const sizeAfter = (
  width: number,
  height: number,
  step: ResizeStep,
): { width: number; height: number } => {
  if (step === null) {
    return { width, height };
  }
  if ("width" in step) {
    return {
      width: step.width,
      height: Math.max(1, Math.round((height * step.width) / width)),
    };
  }
  return {
    width: Math.max(1, Math.round((width * step.height) / height)),
    height: step.height,
  };
};

// Is an encoded photo acceptable to upload?
export const fitsUpload = (bytes: number) =>
  bytes > 0 && bytes <= PHOTO_MAX_BYTES;

// Next JPEG quality to try after an encode of `bytes` at `qualityIndex`, or
// null when the target is met or the qualities are used up (then the caller
// shrinks the size instead).
export const nextQualityIndex = (qualityIndex: number, bytes: number) =>
  bytes <= PHOTO_TARGET_BYTES || qualityIndex + 1 >= PHOTO_QUALITIES.length
    ? null
    : qualityIndex + 1;

// How many more photos a composer can take, and how many picked ones to drop.
export const photoSlots = (current: number, picked: number, max: number) => {
  const free = Math.max(0, max - current);

  return { accept: Math.min(free, picked), dropped: Math.max(0, picked - free) };
};
