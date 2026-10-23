"use server";

import { and, eq, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ROUTES } from "@/constants/routes";
import { TIME_ZONE } from "@/constants/time";
import { db } from "@/db";
import {
  exerciseCompletions,
  exercises,
  exerciseSets,
  workoutDays,
} from "@/db/schema";
import { WORKOUT_MESSAGES } from "@/features/workouts/constants/messages";
import {
  exerciseSetsSchema,
  isPersonalBest,
  type SetInput,
  type SetSession,
} from "@/features/workouts/utils/sets";
import { groupSetSessions } from "@/features/workouts/utils/week-sets";
import { withResultErrorHandling } from "@/services/action-errors";
import { requireUser } from "@/services/auth-guard";
import type { SaveSetsResult } from "@/types/error";
import { getAdminUserPath } from "@/utils/routes";
import { getTodayDate } from "@/utils/week";

// Earlier sessions of the same user + youtubeId (Q6), strictly before `date`
// (D6, D7), grouped per exercise for isPersonalBest.
const getEarlierSessions = async (
  userId: number,
  youtubeId: string,
  date: string,
): Promise<SetSession[]> => {
  const rows = await db
    .select({
      exerciseId: exerciseSets.exerciseId,
      userId: exerciseSets.userId,
      youtubeId: exercises.youtubeId,
      date: workoutDays.date,
      position: exerciseSets.position,
      weightKg: exerciseSets.weightKg,
      reps: exerciseSets.reps,
    })
    .from(exerciseSets)
    .innerJoin(exercises, eq(exercises.id, exerciseSets.exerciseId))
    .innerJoin(workoutDays, eq(workoutDays.id, exercises.dayId))
    .where(
      and(
        eq(exerciseSets.userId, userId),
        eq(workoutDays.userId, userId),
        eq(exercises.youtubeId, youtubeId),
        lt(workoutDays.date, date),
      ),
    );

  return groupSetSessions(rows);
};

// Replaces the exercise's logged sets with `sets` (D1). Saving at least one
// set marks the exercise done (Q4); an empty list only clears the sets (D2).
export const saveExerciseSetsAction = withResultErrorHandling(
  "saveExerciseSets",
  // `sets` comes from the browser, so it is validated despite its type.
  async (exerciseId: number, sets: SetInput[]): Promise<SaveSetsResult> => {
    const user = await requireUser();
    const id = z.number().int().positive().parse(exerciseId);
    const parsed = exerciseSetsSchema.safeParse(sets);

    if (!parsed.success) {
      return {
        status: "error",
        message:
          parsed.error.issues[0]?.message ?? WORKOUT_MESSAGES.INVALID_INPUT,
      };
    }

    const [exercise] = await db
      .select({
        id: exercises.id,
        date: workoutDays.date,
        youtubeId: exercises.youtubeId,
      })
      .from(exercises)
      .innerJoin(workoutDays, eq(workoutDays.id, exercises.dayId))
      .where(and(eq(exercises.id, id), eq(workoutDays.userId, user.id)))
      .limit(1);

    if (!exercise) {
      return { status: "error", message: WORKOUT_MESSAGES.EXERCISE_NOT_FOUND };
    }

    // Same rule as the completion toggle: today and past days only (Q7).
    if (exercise.date > getTodayDate(TIME_ZONE)) {
      return {
        status: "error",
        message: WORKOUT_MESSAGES.COMPLETION_TOO_EARLY,
      };
    }

    const newSets = parsed.data;

    await db.transaction(async (tx) => {
      await tx
        .delete(exerciseSets)
        .where(eq(exerciseSets.exerciseId, exercise.id));

      if (newSets.length === 0) {
        return;
      }

      await tx.insert(exerciseSets).values(
        newSets.map((set, position) => ({
          exerciseId: exercise.id,
          userId: user.id,
          position,
          weightKg: set.weightKg,
          reps: set.reps,
        })),
      );
      await tx
        .insert(exerciseCompletions)
        .values({
          exerciseId: exercise.id,
          userId: user.id,
          completedAt: new Date(),
        })
        .onConflictDoNothing();
    });

    // Read-only and strictly earlier dates, so it never sees the sets above.
    const personalBest =
      newSets.length > 0 &&
      isPersonalBest(
        newSets,
        await getEarlierSessions(user.id, exercise.youtubeId, exercise.date),
        { userId: user.id, youtubeId: exercise.youtubeId, date: exercise.date },
      );

    revalidatePath(ROUTES.WORKOUTS);
    revalidatePath(ROUTES.ADMIN, "layout");
    revalidatePath(getAdminUserPath(user.id), "layout");
    return { status: "success", personalBest };
  },
);
