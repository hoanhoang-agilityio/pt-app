import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_DATA_URL_LENGTH,
  PHOTO_MAX_SIDE,
} from "@/features/exercise-library/constants/limits";
import {
  readImageSize,
  sniffPhotoMime,
} from "@/features/chat/utils/photo-rules";

export type ExercisePhotoMime = "image/webp" | "image/jpeg";

export type ExercisePhotoResult =
  | {
      ok: true;
      mime: ExercisePhotoMime;
      bytes: Uint8Array;
      width: number;
      height: number;
    }
  | { ok: false; reason: "invalid" | "too-large" };

const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

// The server never trusts the browser's numbers: the type, size and bytes come
// from the data URL itself, and the long side must respect the resize limit.
export const decodeExercisePhoto = (dataUrl: string): ExercisePhotoResult => {
  if (dataUrl.length > PHOTO_MAX_DATA_URL_LENGTH) {
    return { ok: false, reason: "too-large" };
  }
  const match = DATA_URL.exec(dataUrl);

  if (!match) {
    return { ok: false, reason: "invalid" };
  }
  const bytes = new Uint8Array(Buffer.from(match[2], "base64"));

  if (bytes.length === 0) {
    return { ok: false, reason: "invalid" };
  }
  if (bytes.length > PHOTO_MAX_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  const mime = sniffPhotoMime(bytes);

  if ((mime !== "image/webp" && mime !== "image/jpeg") || mime !== match[1]) {
    return { ok: false, reason: "invalid" };
  }
  const size = readImageSize(bytes, mime);

  if (
    !size ||
    size.width < 1 ||
    size.height < 1 ||
    Math.max(size.width, size.height) > PHOTO_MAX_SIDE
  ) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, mime, bytes, ...size };
};

// Versioned URL of a custom photo; null without a photo.
export const exercisePhotoUrl = (
  id: number,
  hasPhoto: boolean,
  updatedAt: Date,
) =>
  hasPhoto
    ? `/api/exercises/${id}/photo?v=${Math.floor(updatedAt.getTime() / 1000)}`
    : null;
