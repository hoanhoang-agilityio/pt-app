import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import {
  AVATAR_QUALITIES,
  AVATAR_SIDE,
  fitsAvatar,
  toDataUrl,
} from "./avatar-plan";
import { PhotoPermissionError, PhotoTooLargeError } from "./photos";

// Lets the user pick and square-crop a photo, then returns it as a JPEG data
// URL of 256 px that fits the API limit; null when the picker was cancelled.
export const pickAvatarDataUrl = async (): Promise<string | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted && permission.accessPrivileges !== "limited") {
    throw new PhotoPermissionError();
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }
  const asset = result.assets[0];
  const side = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);

  // Some pickers ignore the aspect: crop the centre square ourselves.
  if (asset.width !== asset.height) {
    context.crop({
      originX: Math.floor((asset.width - side) / 2),
      originY: Math.floor((asset.height - side) / 2),
      width: side,
      height: side,
    });
  }
  const image = await context.resize({ width: AVATAR_SIDE, height: AVATAR_SIDE }).renderAsync();

  for (const quality of AVATAR_QUALITIES) {
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: quality,
      base64: true,
    });
    const dataUrl = saved.base64 ? toDataUrl(saved.base64) : "";

    if (dataUrl && fitsAvatar(dataUrl)) {
      return dataUrl;
    }
  }
  throw new PhotoTooLargeError();
};
