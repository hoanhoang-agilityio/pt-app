import type { Food, FoodGroup } from "@/features/foods/types/food";
import { toNameKey } from "@/utils/name";

export type FoodGroupFilter = FoodGroup | "all";

interface FoodFilter {
  query: string;
  group: FoodGroupFilter;
}

// Accent- and case-insensitive: "uc ga" finds "Ức gà (chín)". Every word of
// the query must appear in the name, in any order.
export const filterFoods = <T extends Pick<Food, "name" | "group">>(
  foods: T[],
  { query, group }: FoodFilter,
): T[] => {
  const words = toNameKey(query).split(" ").filter(Boolean);

  return foods.filter((food) => {
    if (group !== "all" && food.group !== group) {
      return false;
    }
    const key = toNameKey(food.name);

    return words.every((word) => key.includes(word));
  });
};
