import {
  AVATAR_MAX_DATA_URL_LENGTH,
  AVATAR_SIZE_PX,
  STICKER_CUSTOM_MAX_BYTES,
} from "@pt/contracts";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import {
  fitsUpload,
  nextQualityIndex,
  PHOTO_MAX_SIDE,
  PHOTO_QUALITIES,
  planResize,
  sizeAfter,
  squareCrop,
  STICKER_SIZES,
} from "./image-plan";

// Picks photos and turns each into JPEG bytes the API accepts (<= 1.5 MB and
// <= 1600 px). Decisions live in image-plan.ts (unit-tested).

export type PickedPhoto = { uri: string; width: number; height: number };
export type PreparedPhoto = {
  uri: string;
  blob: Blob;
  width: number;
  height: number;
};

export class PhotoPermissionError extends Error {}
export class PhotoTooLargeError extends Error {}

export const pickPhotos = async (limit: number): Promise<PickedPhoto[]> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted && permission.accessPrivileges !== "limited") {
    throw new PhotoPermissionError();
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 1,
  });

  if (result.canceled) {
    return [];
  }
  return result.assets.map(({ uri, width, height }) => ({ uri, width, height }));
};

const encode = async (
  uri: string,
  width: number,
  height: number,
  maxSide: number,
  qualityIndex: number,
) => {
  const step = planResize(width, height, maxSide);
  const context = ImageManipulator.manipulate(uri);

  if (step) {
    context.resize(step);
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: PHOTO_QUALITIES[qualityIndex],
  });
  const blob = await (await fetch(saved.uri)).blob();

  return { uri: saved.uri, blob, width: saved.width, height: saved.height };
};

// Resizes to at most 1600 px and lowers the JPEG quality step by step until
// the file is small; shrinks the size when even the lowest quality is large.
export const preparePhoto = async (photo: PickedPhoto): Promise<PreparedPhoto> => {
  let maxSide = PHOTO_MAX_SIDE;

  for (let round = 0; round < 3; round += 1) {
    let qualityIndex = 0;
    let result = await encode(photo.uri, photo.width, photo.height, maxSide, qualityIndex);

    for (
      let next = nextQualityIndex(qualityIndex, result.blob.size);
      next !== null;
      next = nextQualityIndex(qualityIndex, result.blob.size)
    ) {
      qualityIndex = next;
      result = await encode(photo.uri, photo.width, photo.height, maxSide, qualityIndex);
    }
    if (fitsUpload(result.blob.size)) {
      return result;
    }
    const smaller = sizeAfter(photo.width, photo.height, planResize(photo.width, photo.height, maxSide));

    maxSide = Math.round(Math.max(smaller.width, smaller.height) * 0.75);
  }
  throw new PhotoTooLargeError();
};

export const PHOTO_CONTENT_TYPE = "image/jpeg";

// ---- Square images: group avatars and custom stickers ------------------------

const squareImage = async (
  photo: PickedPhoto,
  side: number,
  format: SaveFormat,
  compress: number,
  base64: boolean,
) => {
  const crop = squareCrop(photo.width, photo.height);
  const context = ImageManipulator.manipulate(photo.uri).crop(crop).resize({ width: side });
  const image = await context.renderAsync();

  return image.saveAsync({ format, compress, base64 });
};

// A 256 px square JPEG as a data URL of at most AVATAR_MAX_DATA_URL_LENGTH
// (the group avatar route validates it like account avatars).
export const toAvatarDataUrl = async (photo: PickedPhoto) => {
  for (const quality of [0.8, 0.6, 0.4]) {
    const saved = await squareImage(photo, AVATAR_SIZE_PX, SaveFormat.JPEG, quality, true);
    const url = `data:image/jpeg;base64,${saved.base64 ?? ""}`;

    if (url.length <= AVATAR_MAX_DATA_URL_LENGTH) {
      return url;
    }
  }
  throw new PhotoTooLargeError();
};

// A square PNG that fits the custom sticker cap (150 KB), shrinking by steps.
export const toStickerBlob = async (photo: PickedPhoto) => {
  for (const side of STICKER_SIZES) {
    const saved = await squareImage(photo, side, SaveFormat.PNG, 1, false);
    const blob = await (await fetch(saved.uri)).blob();

    if (blob.size <= STICKER_CUSTOM_MAX_BYTES) {
      return blob;
    }
  }
  throw new PhotoTooLargeError();
};

export const STICKER_CONTENT_TYPE = "image/png";
