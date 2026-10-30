import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { foods, mealLogs, mealMarks } from "@/db/schema";
import { MEAL_LOG_MESSAGES } from "@/features/meal-plans/constants/meal-plans";
import type { MealLog, MealMark } from "@/features/meal-plans/types/meal-log";
import { resolveLogNutrition } from "@/features/meal-plans/utils/meal-log";

const NO_NUMBERS = { kcal: null, protein: null, carbs: null, fat: null };

// Logs and marks of the given plan meals (the trainee's page and the PT's
// view read the same). Archived foods still resolve: a log keeps its numbers.
export const getMealLogData = async (mealIds: number[]) => {
  if (!mealIds.length) {
    return { logs: [] as MealLog[], marks: [] as MealMark[] };
  }

  const [logRows, markRows] = await Promise.all([
    db
      .select({
        log: mealLogs,
        food: {
          name: foods.name,
          kcal: foods.kcal,
          protein: foods.protein,
          carbs: foods.carbs,
          fat: foods.fat,
          archivedAt: foods.archivedAt,
        },
      })
      .from(mealLogs)
      .leftJoin(foods, eq(foods.id, mealLogs.foodId))
      .where(inArray(mealLogs.mealId, mealIds))
      .orderBy(asc(mealLogs.id)),
    db.select().from(mealMarks).where(inArray(mealMarks.mealId, mealIds)),
  ]);

  const logs: MealLog[] = logRows.map(({ log, food }) => {
    const typed = {
      kcal: log.kcal,
      protein: log.protein,
      carbs: log.carbs,
      fat: log.fat,
    };

    const isMissingFood = log.foodId !== null && !food;

    return {
      id: log.id,
      mealId: log.mealId,
      foodId: log.foodId,
      name: isMissingFood
        ? MEAL_LOG_MESSAGES.MISSING_FOOD_NAME
        : (food?.name ?? log.customName ?? ""),
      isFree: log.foodId === null,
      isArchived: food?.archivedAt != null,
      isMissingFood,
      grams: log.grams,
      typed: log.foodId !== null ? NO_NUMBERS : typed,
      // A missing food has nothing to scale: any numbers stored on the row
      // are kept, otherwise none (not zeros).
      nutrition: resolveLogNutrition(log.grams, food ?? null, typed),
    };
  });

  return {
    logs,
    marks: markRows.map((row) => ({
      mealId: row.mealId,
      achieved: row.achieved,
      note: row.note,
    })),
  };
};

// A log of this trainee: ids from the browser may belong to someone else, to
// a plan that was deleted, or to nothing.
export const findOwnedLog = async (userId: number, logId: number) => {
  const [row] = await db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.id, logId), eq(mealLogs.userId, userId)));

  return row ?? null;
};
