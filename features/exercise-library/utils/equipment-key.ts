import {
  EQUIPMENT_KEYS,
  type EquipmentKey,
} from "@/features/exercise-library/constants/labels";
import en from "@/messages/en/exerciseLibrary.json";
import vi from "@/messages/vi/exerciseLibrary.json";
import zh from "@/messages/zh/exerciseLibrary.json";
import { toNameKey } from "@/utils/name";

const singular = (flat: string) =>
  flat.length > 3 && flat.endsWith("s") ? flat.slice(0, -1) : flat;

// Case-, space-, hyphen- and plural-insensitive, accents kept: "Tạ đơn" and
// "tạ  đơn", "EZ-curl bar" and "e_z_curl_bar", "Dumbbells" and "dumbbell".
const exact = (text: string) =>
  singular(
    text
      .normalize("NFC")
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, ""),
  );

// The same without accents, for text typed on a phone without them. "Tạ đơn"
// (dumbbell) and "Tạ đòn" (barbell) collapse to one word, so a collision stays
// unmatched rather than guessing.
const loose = (text: string) =>
  singular(toNameKey(text).replace(/[^\p{L}\p{N}]+/gu, ""));

const EXACT = new Map<string, EquipmentKey>();
const LOOSE = new Map<string, EquipmentKey | null>();

for (const key of EQUIPMENT_KEYS) {
  for (const text of [
    key,
    vi.equipmentNames[key],
    en.equipmentNames[key],
    zh.equipmentNames[key],
  ]) {
    EXACT.set(exact(text), key);

    const seen = LOOSE.get(loose(text));

    LOOSE.set(loose(text), seen === undefined || seen === key ? key : null);
  }
}

// The equipment key a custom exercise's free text stands for, or null when it
// reads as none of them (it then never matches an equipment filter).
export const matchEquipmentKey = (text: string | null): EquipmentKey | null =>
  text ? (EXACT.get(exact(text)) ?? LOOSE.get(loose(text)) ?? null) : null;
