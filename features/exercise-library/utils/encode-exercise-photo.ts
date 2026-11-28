import { fitWithin } from "@/features/chat/utils/custom-sticker-rules";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_SIDE,
  PHOTO_TARGET_BYTES,
} from "@/features/exercise-library/constants/limits";

// Browser only. Decodes a picked photo (EXIF orientation applied), fits it into
// PHOTO_MAX_SIDE and re-encodes it as WebP (JPEG where WebP cannot be written),
// lowering the quality, then the size, until it is under the target. Returns a
// data URL for the server action. Throws when the file cannot be decoded or
// will not get small enough.
const QUALITIES = [0.82, 0.7, 0.55, 0.4];
const MAX_SHRINKS = 3;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const encodeExercisePhoto = async (file: Blob): Promise<string> => {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  try {
    let { width, height } = fitWithin(
      bitmap.width,
      bitmap.height,
      PHOTO_MAX_SIDE,
    );

    for (let round = 0; round <= MAX_SHRINKS; round += 1) {
      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas is not available");
      }
      // JPEG has no alpha: a transparent PNG would turn black.
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      let smallest: Blob | null = null;

      for (const quality of QUALITIES) {
        let blob = await toBlob(canvas, "image/webp", quality);

        if (blob?.type !== "image/webp") {
          blob = await toBlob(canvas, "image/jpeg", quality);
        }
        if (blob && (!smallest || blob.size < smallest.size)) {
          smallest = blob;
        }
        if (blob && blob.size <= PHOTO_TARGET_BYTES) {
          break;
        }
      }
      if (smallest && smallest.size <= PHOTO_MAX_BYTES) {
        return await toDataUrl(smallest);
      }
      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }
    throw new Error("Photo is too large");
  } finally {
    bitmap.close();
  }
};
