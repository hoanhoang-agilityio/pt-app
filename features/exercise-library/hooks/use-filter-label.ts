"use client";

import { useTranslations } from "next-intl";

import type { FilterGroup } from "@/features/exercise-library/constants/filters";
import type {
  CategoryKey,
  EquipmentKey,
  LevelKey,
} from "@/features/exercise-library/constants/labels";
import type { MuscleKey } from "@/features/exercise-library/constants/muscles";

// The translated name of one filter option, by group and key.
export const useFilterLabel = () => {
  const tMuscles = useTranslations("exerciseLibrary.muscles");
  const tEquipment = useTranslations("exerciseLibrary.equipmentNames");
  const tLevels = useTranslations("exerciseLibrary.levels");
  const tCategories = useTranslations("exerciseLibrary.categories");

  return (group: FilterGroup, key: string): string => {
    switch (group) {
      case "muscles":
        return tMuscles(key as MuscleKey);
      case "equipment":
        return tEquipment(key as EquipmentKey);
      case "levels":
        return tLevels(key as LevelKey);
      case "categories":
        return tCategories(key as CategoryKey);
    }
  };
};
