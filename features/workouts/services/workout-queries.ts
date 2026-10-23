import "server-only";

import { and, asc, between, eq, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  exerciseCompletions,
  exercises,
  exerciseSets,
  workoutDays,
} from "@/db/schema";
import type {
  Exercise,
  ScheduleDay,
  ScheduleDayWithSets,
} from "@/features/workouts/types/workout";
import {
  attachSetsToWeek,
  groupSetSessions,
} from "@/features/workouts/utils/week-sets";
import { getWeekDates } from "@/utils/week";

const toExercise = (
  row: typeof exercises.$inferSelect,
  completedAt: Date | null,
): Exercise => ({
  id: row.id,
  title: row.title,
  description: row.description,
  sets: row.sets,
  reps: row.reps,
  youtubeId: row.youtubeId,
  position: row.position,
  completedAt: completedAt?.getTime() ?? null,
});

export const getWeekSchedule = async (
  userId: number,
  weekStart: string,
): Promise<ScheduleDay[]> => {
  const dates = getWeekDates(weekStart);
  const days = await db
    .select()
    .from(workoutDays)
    .where(
      and(
        eq(workoutDays.userId, userId),
        between(workoutDays.date, dates[0], dates[dates.length - 1]),
      ),
    );
  const dayIds = days.map((day) => day.id);
  const exerciseRows = dayIds.length
    ? await db
        .select({
          exercise: exercises,
          completedAt: exerciseCompletions.completedAt,
        })
        .from(exercises)
        .leftJoin(
          exerciseCompletions,
          eq(exerciseCompletions.exerciseId, exercises.id),
        )
        .where(inArray(exercises.dayId, dayIds))
        .orderBy(asc(exercises.position), asc(exercises.id))
    : [];

  return dates.map((date) => {
    const day = days.find((item) => item.date === date);

    return {
      date,
      title: day?.title ?? "",
      note: day?.note ?? "",
      exercises: day
        ? exerciseRows
            .filter((row) => row.exercise.dayId === day.id)
            .map((row) => toExercise(row.exercise, row.completedAt))
        : [],
    };
  });
};

// getWeekSchedule plus each exercise's logged sets, last-session hints and
// record flag (KAN-29). One extra query covers both this week's sets and all
// earlier sessions of the week's links, so there is no query per exercise.
export const getWeekScheduleWithSets = async (
  userId: number,
  weekStart: string,
): Promise<ScheduleDayWithSets[]> => {
  const days = await getWeekSchedule(userId, weekStart);
  const youtubeIds = [
    ...new Set(
      days.flatMap((day) => day.exercises.map((item) => item.youtubeId)),
    ),
  ];
  const rows = youtubeIds.length
    ? await db
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
            inArray(exercises.youtubeId, youtubeIds),
            lte(workoutDays.date, days[days.length - 1].date),
          ),
        )
    : [];

  return attachSetsToWeek(days, userId, groupSetSessions(rows));
};
