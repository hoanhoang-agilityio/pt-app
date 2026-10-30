import type { foods } from "@/db/schema";

export type FoodGroup = (typeof foods.$inferSelect)["group"];

export type FoodState = NonNullable<(typeof foods.$inferSelect)["state"]>;

// What the screens and the math need; per 100 g.
export interface Food {
  id: number;
  name: string;
  group: FoodGroup;
  state: FoodState | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  servingLabel: string | null;
  servingGrams: number | null;
  source: string;
}

// The numbers a food contributes for some amount.
export interface FoodAmount {
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type MacroShare = Record<"protein" | "carbs" | "fat", number>;
