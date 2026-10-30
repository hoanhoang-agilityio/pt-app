"use server";

import { and, asc, between, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { db } from "@/db";
import { mealPlanDays, mealPlanItems, mealPlanMeals } from "@/db/schema";
import { getFood } from "@/features/foods/services/food-queries";
import {
  MEAL_PLAN_LIMITS,
  MEAL_PLAN_MESSAGES,
} from "@/features/meal-plans/constants/meal-plans";
import { getTargetForDate } from "@/features/meal-plans/services/meal-plan-queries";
import {
  addItemSchema,
  addMealSchema,
  applyLastWeekSchema,
  autoSolveSchema,
  copyDaySchema,
  createDayPlanSchema,
  deleteDayPlanSchema,
  removeItemSchema,
  removeMealSchema,
  renameMealSchema,
  reorderMealsSchema,
  setMealSharesSchema,
  updateItemGramsSchema,
} from "@/features/meal-plans/services/meal-plan-schemas";
import {
  cloneDay,
  deleteDays,
  deleteMeals,
  findOwnedDay,
  findOwnedItem,
  findOwnedMeal,
  listDayMeals,
  listMealItems,
} from "@/features/meal-plans/services/meal-plan-store";
import {
  getDefaultMealNames,
  getNextMealName,
  resolveMealCount,
} from "@/features/meal-plans/utils/default-meals";
import { splitDayTarget } from "@/features/meal-plans/utils/meal-targets";
import { solveGrams } from "@/features/meal-plans/utils/solve-grams";
import { withResultErrorHandling } from "@/services/action-errors";
import { requireAdmin } from "@/services/auth-guard";
import { findUserById } from "@/services/users";
import type { ActionErrorResult, ActionResult } from "@/types/error";
import { isUniqueViolation } from "@/utils/errors";
import { getAdminNutritionPath } from "@/utils/routes";
import { addDays, getWeekDates, getWeekStart } from "@/utils/week";

const DEFAULT_ITEM_GRAMS = 100;

const fail = (message: string): ActionErrorResult => ({
  status: "error",
  message,
});

const ok: ActionResult = { status: "success" };

const refresh = (userId: number) => {
  revalidatePath(getAdminNutritionPath(userId));
};

// Zod failures are the PT's input problem, not a server error: a plain
// message, not the generic one with a reference.
const read = <Schema extends z.ZodType>(schema: Schema, input: unknown) => {
  const parsed = schema.safeParse(input);

  return parsed.success
    ? ({ data: parsed.data as z.output<Schema> } as const)
    : ({ error: fail(MEAL_PLAN_MESSAGES.INVALID_INPUT) } as const);
};

export type CopyResult =
  { status: "success"; copied: number; skipped: number } | ActionErrorResult;

// Creates the plan of a day with the default meals: the trainee's request
// when there is one, else 3 (Q2).
export const createDayPlanAction = withResultErrorHandling(
  "createDayPlan",
  async (input: z.input<typeof createDayPlanSchema>) => {
    await requireAdmin();

    const { data, error } = read(createDayPlanSchema, input);

    if (!data) {
      return error;
    }

    const member = await findUserById(data.userId);

    if (!member) {
      return fail(MEAL_PLAN_MESSAGES.MEMBER_NOT_FOUND);
    }

    const names = getDefaultMealNames(
      resolveMealCount(member.preferredMealCount),
    );

    try {
      await db.transaction(async (tx) => {
        const [day] = await tx
          .insert(mealPlanDays)
          .values({ userId: data.userId, date: data.date })
          .returning({ id: mealPlanDays.id });

        await tx
          .insert(mealPlanMeals)
          .values(
            names.map((name, position) => ({ dayId: day.id, position, name })),
          );
      });
    } catch (caught) {
      // The day got a plan between the page load and this click.
      if (isUniqueViolation(caught)) {
        return fail(MEAL_PLAN_MESSAGES.PLAN_EXISTS);
      }
      throw caught;
    }

    refresh(data.userId);
    return ok;
  },
);

export const deleteDayPlanAction = withResultErrorHandling(
  "deleteDayPlan",
  async (input: z.input<typeof deleteDayPlanSchema>) => {
    await requireAdmin();

    const { data, error } = read(deleteDayPlanSchema, input);

    if (!data) {
      return error;
    }

    const day = await findOwnedDay(data.userId, data.dayId);

    if (!day) {
      return fail(MEAL_PLAN_MESSAGES.DAY_NOT_FOUND);
    }
    await db.transaction((tx) => deleteDays([day.id], tx));

    refresh(data.userId);
    return ok;
  },
);

export const addMealAction = withResultErrorHandling(
  "addMeal",
  async (input: z.input<typeof addMealSchema>) => {
    await requireAdmin();

    const { data, error } = read(addMealSchema, input);

    if (!data) {
      return error;
    }

    const day = await findOwnedDay(data.userId, data.dayId);

    if (!day) {
      return fail(MEAL_PLAN_MESSAGES.DAY_NOT_FOUND);
    }

    const meals = await listDayMeals(day.id);

    if (meals.length >= MEAL_PLAN_LIMITS.MAX_MEALS_PER_DAY) {
      return fail(MEAL_PLAN_MESSAGES.TOO_MANY_MEALS);
    }

    await db.transaction(async (tx) => {
      await tx.insert(mealPlanMeals).values({
        dayId: day.id,
        position: meals.length ? meals[meals.length - 1].position + 1 : 0,
        name: getNextMealName(meals.map((meal) => meal.name)),
      });
      // A custom split would no longer total 100: back to equal.
      await tx
        .update(mealPlanMeals)
        .set({ sharePercent: null })
        .where(eq(mealPlanMeals.dayId, day.id));
    });

    refresh(data.userId);
    return ok;
  },
);

export const removeMealAction = withResultErrorHandling(
  "removeMeal",
  async (input: z.input<typeof removeMealSchema>) => {
    await requireAdmin();

    const { data, error } = read(removeMealSchema, input);

    if (!data) {
      return error;
    }

    const found = await findOwnedMeal(data.userId, data.mealId);

    if (!found) {
      return fail(MEAL_PLAN_MESSAGES.MEAL_NOT_FOUND);
    }

    const meals = await listDayMeals(found.day.id);

    if (meals.length <= 1) {
      return fail(MEAL_PLAN_MESSAGES.LAST_MEAL);
    }

    await db.transaction(async (tx) => {
      await deleteMeals([found.meal.id], tx);

      const rest = meals.filter((meal) => meal.id !== found.meal.id);

      for (const [position, meal] of rest.entries()) {
        await tx
          .update(mealPlanMeals)
          .set({ position, sharePercent: null })
          .where(eq(mealPlanMeals.id, meal.id));
      }
    });

    refresh(data.userId);
    return ok;
  },
);

export const renameMealAction = withResultErrorHandling(
  "renameMeal",
  async (input: z.input<typeof renameMealSchema>) => {
    await requireAdmin();

    const { data, error } = read(renameMealSchema, input);

    if (!data) {
      return error;
    }

    const found = await findOwnedMeal(data.userId, data.mealId);

    if (!found) {
      return fail(MEAL_PLAN_MESSAGES.MEAL_NOT_FOUND);
    }
    await db
      .update(mealPlanMeals)
      .set({ name: data.name })
      .where(eq(mealPlanMeals.id, found.meal.id));

    refresh(data.userId);
    return ok;
  },
);

// `mealIds` is the new order; it must list exactly the meals of the day.
export const reorderMealsAction = withResultErrorHandling(
  "reorderMeals",
  async (input: z.input<typeof reorderMealsSchema>) => {
    await requireAdmin();

    const { data, error } = read(reorderMealsSchema, input);

    if (!data) {
      return error;
    }

    const day = await findOwnedDay(data.userId, data.dayId);

    if (!day) {
      return fail(MEAL_PLAN_MESSAGES.DAY_NOT_FOUND);
    }

    const meals = await listDayMeals(day.id);
    const known = new Set(meals.map((meal) => meal.id));

    if (
      data.mealIds.length !== meals.length ||
      new Set(data.mealIds).size !== meals.length ||
      !data.mealIds.every((id) => known.has(id))
    ) {
      return fail(MEAL_PLAN_MESSAGES.REORDER_MISMATCH);
    }

    await db.transaction(async (tx) => {
      for (const [position, mealId] of data.mealIds.entries()) {
        await tx
          .update(mealPlanMeals)
          .set({ position })
          .where(eq(mealPlanMeals.id, mealId));
      }
    });

    refresh(data.userId);
    return ok;
  },
);

// Q4: a percent per meal, total 100; `shares: null` goes back to equal.
export const setMealSharesAction = withResultErrorHandling(
  "setMealShares",
  async (input: z.input<typeof setMealSharesSchema>) => {
    await requireAdmin();

    const { data, error } = read(setMealSharesSchema, input);

    if (!data) {
      return error;
    }

    const day = await findOwnedDay(data.userId, data.dayId);

    if (!day) {
      return fail(MEAL_PLAN_MESSAGES.DAY_NOT_FOUND);
    }

    const meals = await listDayMeals(day.id);
    const percentById = new Map<number, number | null>(
      meals.map((meal) => [meal.id, null]),
    );

    if (data.shares) {
      const listed = new Set(data.shares.map((share) => share.mealId));

      if (
        data.shares.length !== meals.length ||
        listed.size !== meals.length ||
        !data.shares.every((share) => percentById.has(share.mealId))
      ) {
        return fail(MEAL_PLAN_MESSAGES.REORDER_MISMATCH);
      }
      for (const share of data.shares) {
        percentById.set(share.mealId, share.percent);
      }

      const split = splitDayTarget(
        { carbs: 0, protein: 0, fat: 0 },
        meals.map((meal) => percentById.get(meal.id) ?? null),
      );

      if (!split.ok) {
        return fail(MEAL_PLAN_MESSAGES.SHARES_TOTAL);
      }
    }

    await db.transaction(async (tx) => {
      for (const [mealId, sharePercent] of percentById) {
        await tx
          .update(mealPlanMeals)
          .set({ sharePercent })
          .where(eq(mealPlanMeals.id, mealId));
      }
    });

    refresh(data.userId);
    return ok;
  },
);

export const addItemAction = withResultErrorHandling(
  "addMealItem",
  async (input: z.input<typeof addItemSchema>) => {
    await requireAdmin();

    const { data, error } = read(addItemSchema, input);

    if (!data) {
      return error;
    }

    const found = await findOwnedMeal(data.userId, data.mealId);

    if (!found) {
      return fail(MEAL_PLAN_MESSAGES.MEAL_NOT_FOUND);
    }

    // Archived foods stay in plans that have them but can't be added anew.
    const food = await getFood(data.foodId);

    if (!food) {
      return fail(MEAL_PLAN_MESSAGES.FOOD_NOT_FOUND);
    }

    const items = await listMealItems(found.meal.id);

    if (items.some((item) => item.foodId === food.id)) {
      return fail(MEAL_PLAN_MESSAGES.FOOD_ALREADY_IN_MEAL);
    }
    if (items.length >= MEAL_PLAN_LIMITS.MAX_ITEMS_PER_MEAL) {
      return fail(MEAL_PLAN_MESSAGES.TOO_MANY_ITEMS);
    }

    await db.insert(mealPlanItems).values({
      mealId: found.meal.id,
      foodId: food.id,
      grams: data.grams ?? DEFAULT_ITEM_GRAMS,
    });

    refresh(data.userId);
    return ok;
  },
);

export const removeItemAction = withResultErrorHandling(
  "removeMealItem",
  async (input: z.input<typeof removeItemSchema>) => {
    await requireAdmin();

    const { data, error } = read(removeItemSchema, input);

    if (!data) {
      return error;
    }

    const found = await findOwnedItem(data.userId, data.itemId);

    if (!found) {
      return fail(MEAL_PLAN_MESSAGES.ITEM_NOT_FOUND);
    }
    await db.delete(mealPlanItems).where(eq(mealPlanItems.id, found.item.id));

    refresh(data.userId);
    return ok;
  },
);

export const updateItemGramsAction = withResultErrorHandling(
  "updateMealItemGrams",
  async (input: z.input<typeof updateItemGramsSchema>) => {
    await requireAdmin();

    const { data, error } = read(updateItemGramsSchema, input);

    if (!data) {
      return error;
    }

    const found = await findOwnedItem(data.userId, data.itemId);

    if (!found) {
      return fail(MEAL_PLAN_MESSAGES.ITEM_NOT_FOUND);
    }
    await db
      .update(mealPlanItems)
      .set({ grams: data.grams })
      .where(eq(mealPlanItems.id, found.item.id));

    refresh(data.userId);
    return ok;
  },
);

// Q5: sets the grams of the meal's foods (except the fixed ones) so the meal
// reaches its share of the day target. Rounded to 5 g; the gap it leaves is
// worked out again on screen from the saved grams.
export const autoSolveMealAction = withResultErrorHandling(
  "autoSolveMeal",
  async (input: z.input<typeof autoSolveSchema>) => {
    await requireAdmin();

    const { data, error } = read(autoSolveSchema, input);

    if (!data) {
      return error;
    }

    const found = await findOwnedMeal(data.userId, data.mealId);

    if (!found) {
      return fail(MEAL_PLAN_MESSAGES.MEAL_NOT_FOUND);
    }

    const target = await getTargetForDate(data.userId, found.day.date);

    if (!target) {
      return fail(MEAL_PLAN_MESSAGES.NO_TARGET);
    }

    const meals = await listDayMeals(found.day.id);
    const split = splitDayTarget(
      target,
      meals.map((meal) => meal.sharePercent),
    );
    const mealIndex = meals.findIndex((meal) => meal.id === found.meal.id);

    if (!split.ok) {
      return fail(MEAL_PLAN_MESSAGES.SHARES_TOTAL);
    }

    const items = await listMealItems(found.meal.id);
    const itemIds = new Set(items.map((item) => item.id));

    if (!data.fixedItemIds.every((id) => itemIds.has(id))) {
      return fail(MEAL_PLAN_MESSAGES.ITEM_NOT_FOUND);
    }

    const fixedIds = new Set(data.fixedItemIds);
    const toSolve = items.filter((item) => !fixedIds.has(item.id));

    if (!toSolve.length) {
      return fail(MEAL_PLAN_MESSAGES.NOTHING_TO_SOLVE);
    }

    const result = solveGrams({
      target: split.meals[mealIndex],
      // Each item is solved as its own "food": the solver's id is the item id.
      foods: toSolve,
      fixed: items
        .filter((item) => fixedIds.has(item.id))
        .map((item) => ({ food: item, grams: item.grams })),
    });

    await db.transaction(async (tx) => {
      for (const { foodId: itemId, grams } of result.grams) {
        // `foodId` here is the item id passed in above.
        await tx
          .update(mealPlanItems)
          .set({ grams })
          .where(eq(mealPlanItems.id, itemId));
      }
    });

    refresh(data.userId);
    return ok;
  },
);

// Copies a day to the chosen dates; a date that already has a plan gets it
// replaced (the screen says so before the PT confirms).
export const copyDayAction = withResultErrorHandling(
  "copyDayPlan",
  async (input: z.input<typeof copyDaySchema>): Promise<CopyResult> => {
    await requireAdmin();

    const { data, error } = read(copyDaySchema, input);

    if (!data) {
      return error;
    }

    const source = await findOwnedDay(data.userId, data.dayId);

    if (!source) {
      return fail(MEAL_PLAN_MESSAGES.DAY_NOT_FOUND);
    }

    const dates = [...new Set(data.dates)].filter(
      (date) => date !== source.date,
    );

    if (!dates.length) {
      return fail(MEAL_PLAN_MESSAGES.NO_TARGET_DAYS);
    }

    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: mealPlanDays.id })
        .from(mealPlanDays)
        .where(
          and(
            eq(mealPlanDays.userId, data.userId),
            inArray(mealPlanDays.date, dates),
          ),
        );

      await deleteDays(
        existing.map((day) => day.id),
        tx,
      );
      for (const date of dates) {
        await cloneDay(source.id, data.userId, date, tx);
      }
    });

    refresh(data.userId);
    return { status: "success", copied: dates.length, skipped: 0 };
  },
);

// R2: copies last week's plans to the same weekdays of `weekStart`'s week.
// Only the PT's click does this, and a day that already has a plan keeps it.
export const applyLastWeekAction = withResultErrorHandling(
  "applyLastWeek",
  async (input: z.input<typeof applyLastWeekSchema>): Promise<CopyResult> => {
    await requireAdmin();

    const { data, error } = read(applyLastWeekSchema, input);

    if (!data) {
      return error;
    }

    const member = await findUserById(data.userId);

    if (!member) {
      return fail(MEAL_PLAN_MESSAGES.MEMBER_NOT_FOUND);
    }

    const weekStart = getWeekStart(data.weekStart);
    const lastWeek = getWeekDates(addDays(weekStart, -7));
    const sources = await db
      .select()
      .from(mealPlanDays)
      .where(
        and(
          eq(mealPlanDays.userId, data.userId),
          between(
            mealPlanDays.date,
            lastWeek[0],
            lastWeek[lastWeek.length - 1],
          ),
        ),
      )
      .orderBy(asc(mealPlanDays.date));

    if (!sources.length) {
      return fail(MEAL_PLAN_MESSAGES.NO_LAST_WEEK);
    }

    const thisWeek = getWeekDates(weekStart);
    const taken = new Set(
      (
        await db
          .select({ date: mealPlanDays.date })
          .from(mealPlanDays)
          .where(
            and(
              eq(mealPlanDays.userId, data.userId),
              between(
                mealPlanDays.date,
                thisWeek[0],
                thisWeek[thisWeek.length - 1],
              ),
            ),
          )
      ).map((day) => day.date),
    );
    const todo = sources.filter((day) => !taken.has(addDays(day.date, 7)));

    await db.transaction(async (tx) => {
      for (const day of todo) {
        await cloneDay(day.id, data.userId, addDays(day.date, 7), tx);
      }
    });

    refresh(data.userId);
    return {
      status: "success",
      copied: todo.length,
      skipped: sources.length - todo.length,
    };
  },
);
