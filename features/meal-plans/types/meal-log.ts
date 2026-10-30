// What a logged food adds up to, in kcal and grams of macros.
export interface LogNutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealLog {
  id: number;
  mealId: number;
  // Null for a free food.
  foodId: number | null;
  name: string;
  isFree: boolean;
  isArchived: boolean;
  // A library log whose food row is gone: shown with a clear name, no
  // numbers, and refused for editing (removing is fine).
  isMissingFood: boolean;
  // 0 = the trainee did not give an amount (free foods only).
  grams: number;
  // What the trainee typed for a free food (null = left empty); library foods
  // keep these null and show `nutrition`.
  typed: {
    kcal: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
  // Null for a free food typed without any number.
  nutrition: LogNutrition | null;
}

export interface MealMark {
  mealId: number;
  achieved: boolean;
  note: string;
}
