import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { foods, mealPlanDays, mealPlanItems, mealPlanMeals } from "@/db/schema";

// A transaction or the database itself.
export type Executor = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete"
>;

// Every lookup below also checks the member: ids from the browser may belong
// to another member's plan, to a plan that was deleted, or to nothing.
export const findOwnedDay = async (
  userId: number,
  dayId: number,
  executor: Executor = db,
) => {
  const [day] = await executor
    .select()
    .from(mealPlanDays)
    .where(and(eq(mealPlanDays.id, dayId), eq(mealPlanDays.userId, userId)));

  return day ?? null;
};

export const findOwnedMeal = async (
  userId: number,
  mealId: number,
  executor: Executor = db,
) => {
  const [row] = await executor
    .select({ meal: mealPlanMeals, day: mealPlanDays })
    .from(mealPlanMeals)
    .innerJoin(mealPlanDays, eq(mealPlanDays.id, mealPlanMeals.dayId))
    .where(and(eq(mealPlanMeals.id, mealId), eq(mealPlanDays.userId, userId)));

  return row ?? null;
};

export const findOwnedItem = async (
  userId: number,
  itemId: number,
  executor: Executor = db,
) => {
  const [row] = await executor
    .select({ item: mealPlanItems, meal: mealPlanMeals, day: mealPlanDays })
    .from(mealPlanItems)
    .innerJoin(mealPlanMeals, eq(mealPlanMeals.id, mealPlanItems.mealId))
    .innerJoin(mealPlanDays, eq(mealPlanDays.id, mealPlanMeals.dayId))
    .where(and(eq(mealPlanItems.id, itemId), eq(mealPlanDays.userId, userId)));

  return row ?? null;
};

export const listDayMeals = (dayId: number, executor: Executor = db) =>
  executor
    .select()
    .from(mealPlanMeals)
    .where(eq(mealPlanMeals.dayId, dayId))
    .orderBy(asc(mealPlanMeals.position), asc(mealPlanMeals.id));

// Items of a meal with their food, archived or not.
export const listMealItems = (mealId: number, executor: Executor = db) =>
  executor
    .select({
      id: mealPlanItems.id,
      foodId: mealPlanItems.foodId,
      grams: mealPlanItems.grams,
      protein: foods.protein,
      carbs: foods.carbs,
      fat: foods.fat,
    })
    .from(mealPlanItems)
    .innerJoin(foods, eq(foods.id, mealPlanItems.foodId))
    .where(eq(mealPlanItems.mealId, mealId))
    .orderBy(asc(mealPlanItems.id));

// Children first: foreign keys are not enforced (D10).
export const deleteMeals = async (mealIds: number[], executor: Executor) => {
  if (!mealIds.length) {
    return;
  }
  await executor
    .delete(mealPlanItems)
    .where(inArray(mealPlanItems.mealId, mealIds));
  await executor
    .delete(mealPlanMeals)
    .where(inArray(mealPlanMeals.id, mealIds));
};

export const deleteDays = async (dayIds: number[], executor: Executor) => {
  if (!dayIds.length) {
    return;
  }

  const meals = await executor
    .select({ id: mealPlanMeals.id })
    .from(mealPlanMeals)
    .where(inArray(mealPlanMeals.dayId, dayIds));

  await deleteMeals(
    meals.map((meal) => meal.id),
    executor,
  );
  await executor.delete(mealPlanDays).where(inArray(mealPlanDays.id, dayIds));
};

// Copies the meals and foods of `sourceDayId` into a new plan on `date`.
export const cloneDay = async (
  sourceDayId: number,
  userId: number,
  date: string,
  executor: Executor,
) => {
  const [day] = await executor
    .insert(mealPlanDays)
    .values({ userId, date })
    .returning({ id: mealPlanDays.id });

  for (const meal of await listDayMeals(sourceDayId, executor)) {
    const [copy] = await executor
      .insert(mealPlanMeals)
      .values({
        dayId: day.id,
        position: meal.position,
        name: meal.name,
        sharePercent: meal.sharePercent,
      })
      .returning({ id: mealPlanMeals.id });
    const items = await executor
      .select()
      .from(mealPlanItems)
      .where(eq(mealPlanItems.mealId, meal.id))
      .orderBy(asc(mealPlanItems.id));

    if (items.length) {
      await executor.insert(mealPlanItems).values(
        items.map((item) => ({
          mealId: copy.id,
          foodId: item.foodId,
          grams: item.grams,
        })),
      );
    }
  }
  return day.id;
};
