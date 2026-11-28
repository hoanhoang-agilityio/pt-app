"use client";

import { useTranslations } from "next-intl";

import {
  EQUIPMENT_KEYS,
  isLabelKey,
  toLabelKey,
} from "@/features/exercise-library/constants/labels";

// Built-in equipment ("body only") is translated; a custom exercise's
// equipment is free text and shown as typed.
export const useEquipmentLabel = () => {
  const t = useTranslations("exerciseLibrary.equipmentNames");

  return (equipment: string | null, isCustom: boolean) => {
    if (!equipment || isCustom) {
      return equipment;
    }
    const key = toLabelKey(equipment);

    return isLabelKey(EQUIPMENT_KEYS, key) ? t(key) : equipment;
  };
};
