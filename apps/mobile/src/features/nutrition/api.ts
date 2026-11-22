import {
  type AddMealLogBody,
  foodEntryResponseSchema,
  type FoodGroup,
  foodGroupsResponseSchema,
  foodListResponseSchema,
  mealLogResponseSchema,
  mealPlanWeekResponseSchema,
  mealPreferencesResponseSchema,
  nutritionOverviewResponseSchema,
  saveBodyProfileResponseSchema,
  saveWeightResponseSchema,
  setMealMarkResponseSchema,
} from "@pt/contracts";

import { api } from "@/lib/api";

// The trainee's nutrition API (/v1/me/*) and the food library (/v1/foods).
// Number fields of the body-profile, weight and food-entry bodies are sent as
// text, like the web forms: the API parses them with the same schemas.

export type MealKind = "breakfast" | "lunch" | "dinner" | "snack";

export const fetchOverview = (week: string) =>
  api.get("/v1/me/nutrition", {
    query: { week },
    schema: nutritionOverviewResponseSchema,
  });

export const fetchMealPlanWeek = (week: string) =>
  api.get("/v1/me/meal-plan-days", {
    query: { week },
    schema: mealPlanWeekResponseSchema,
  });

export type BodyProfileInput = {
  sex: "male" | "female";
  age: string;
  heightCm: string;
  weightKg: string;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "cut" | "maintain" | "bulk";
};

export const saveBodyProfile = (body: BodyProfileInput) =>
  api.put("/v1/me/body-profile", { body, schema: saveBodyProfileResponseSchema });

export const saveWeight = (date: string, weightKg: string) =>
  api.put(`/v1/me/weight-logs/${date}`, {
    body: { weightKg },
    schema: saveWeightResponseSchema,
  });

export type FoodEntryInput = {
  date: string;
  meal: MealKind;
  description: string;
  carbs: string;
  protein: string;
  fat: string;
};

export const createFoodEntry = (body: FoodEntryInput) =>
  api.post("/v1/me/food-entries", { body, schema: foodEntryResponseSchema });

export const updateFoodEntry = (id: number, body: FoodEntryInput) =>
  api.put(`/v1/me/food-entries/${id}`, { body, schema: foodEntryResponseSchema });

export const deleteFoodEntry = (id: number) => api.delete(`/v1/me/food-entries/${id}`);

export const saveMealPreferences = (body: { mealCount: string; foodNote: string }) =>
  api.put("/v1/me/meal-preferences", {
    body,
    schema: mealPreferencesResponseSchema,
  });

export const addMealLog = (mealId: number, body: AddMealLogBody) =>
  api.post(`/v1/me/meals/${mealId}/logs`, { body, schema: mealLogResponseSchema });

export type UpdateLogInput = {
  grams: number;
  customName?: string;
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

export const updateMealLog = (id: number, body: UpdateLogInput) =>
  api.patch(`/v1/me/meal-logs/${id}`, { body, schema: mealLogResponseSchema });

export const removeMealLog = (id: number) => api.delete(`/v1/me/meal-logs/${id}`);

export const setMealMark = (
  mealId: number,
  body: { achieved: boolean; note: string },
) =>
  api.put(`/v1/me/meals/${mealId}/mark`, {
    body,
    schema: setMealMarkResponseSchema,
  });

export const FOOD_PAGE = 50;

export const fetchFoods = (params: {
  q?: string;
  group?: FoodGroup;
  locale: "vi" | "en" | "zh";
  cursor?: string;
}) =>
  api.get("/v1/foods", {
    query: {
      q: params.q?.trim() || undefined,
      group: params.group,
      locale: params.locale,
      limit: FOOD_PAGE,
      cursor: params.cursor,
    },
    schema: foodListResponseSchema,
  });

export const fetchFoodGroups = () =>
  api.get("/v1/foods/groups", { schema: foodGroupsResponseSchema });
