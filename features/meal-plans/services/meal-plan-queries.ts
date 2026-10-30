import "server-only";

import { and, asc, between, desc, eq, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  foods,
  mealPlanDays,
  mealPlanItems,
  mealPlanMeals,
  nutritionTargets,
} from "@/db/schema";
import { listFoods } from "@/features/foods/services/food-queries";
import type { PlanDay, PlanFood } from "@/features/meal-plans/types/meal-plan";
import { getWeekDates } from "@/utils/week";

// Archived foods are NOT filtered out: a plan keeps showing what it was built
// with (KAN-65: "Xóa" archives).
const planFoodColumns = {
  id: foods.id,
  name: foods.name,
  nameKey: foods.nameKey,
  group: foods.group,
  state: foods.state,
  kcal: foods.kcal,
  protein: foods.protein,
  carbs: foods.carbs,
  fat: foods.fat,
  archivedAt: foods.archivedAt,
};

// The active library the PT searches when adding a food to a meal.
export const listPlanFoods = async (): Promise<PlanFood[]> =>
  (await listFoods()).map((food) => ({
    id: food.id,
    name: food.name,
    nameKey: food.nameKey,
    group: food.group,
    state: food.state,
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    isArchived: false,
  }));

export const getMealPlanWeek = async (
  userId: number,
  weekStart: string,
): Promise<PlanDay[]> => {
  const dates = getWeekDates(weekStart);
  const dayRows = await db
    .select()
    .from(mealPlanDays)
    .where(
      and(
        eq(mealPlanDays.userId, userId),
        between(mealPlanDays.date, dates[0], dates[dates.length - 1]),
      ),
    )
    .orderBy(asc(mealPlanDays.date));

  if (!dayRows.length) {
    return [];
  }

  const dayIds = dayRows.map((day) => day.id);
  const mealRows = await db
    .select()
    .from(mealPlanMeals)
    .where(inArray(mealPlanMeals.dayId, dayIds))
    .orderBy(asc(mealPlanMeals.position), asc(mealPlanMeals.id));
  const itemRows = mealRows.length
    ? await db
        .select({
          id: mealPlanItems.id,
          mealId: mealPlanItems.mealId,
          foodId: mealPlanItems.foodId,
          grams: mealPlanItems.grams,
          food: planFoodColumns,
        })
        .from(mealPlanItems)
        .innerJoin(foods, eq(foods.id, mealPlanItems.foodId))
        .where(
          inArray(
            mealPlanItems.mealId,
            mealRows.map((meal) => meal.id),
          ),
        )
        .orderBy(asc(mealPlanItems.id))
    : [];

  return dayRows.map((day) => ({
    id: day.id,
    date: day.date,
    meals: mealRows
      .filter((meal) => meal.dayId === day.id)
      .map((meal) => ({
        id: meal.id,
        position: meal.position,
        name: meal.name,
        sharePercent: meal.sharePercent,
        items: itemRows
          .filter((item) => item.mealId === meal.id)
          .map(({ food, ...item }) => ({
            ...item,
            food: {
              id: food.id,
              name: food.name,
              nameKey: food.nameKey,
              group: food.group,
              state: food.state,
              kcal: food.kcal,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              isArchived: food.archivedAt !== null,
            },
          })),
      })),
  }));
};

// The macro target that applies on `date` (the latest one that started on or
// before it), the same rule the nutrition week uses.
export const getTargetForDate = async (userId: number, date: string) => {
  const [row] = await db
    .select()
    .from(nutritionTargets)
    .where(
      and(
        eq(nutritionTargets.userId, userId),
        lte(nutritionTargets.effectiveFrom, date),
      ),
    )
    .orderBy(desc(nutritionTargets.effectiveFrom))
    .limit(1);

  return row ? { carbs: row.carbs, protein: row.protein, fat: row.fat } : null;
};

export const countPlanDays = async (userId: number, weekStart: string) => {
  const dates = getWeekDates(weekStart);
  const rows = await db
    .select({ id: mealPlanDays.id })
    .from(mealPlanDays)
    .where(
      and(
        eq(mealPlanDays.userId, userId),
        between(mealPlanDays.date, dates[0], dates[dates.length - 1]),
      ),
    );

  return rows.length;
};
