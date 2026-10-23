import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { TIME_ZONE } from "@/constants/time";
import * as schema from "@/db/schema";
import { toNameKey } from "@/utils/name";
import { addDays, getTodayDate } from "@/utils/week";

import { E2E_USER_NAME } from "./config";

// Exercise titles the spec looks up by name.
export const E2E_EXERCISES = {
  BENCH: "E2E Bench press",
  SQUAT: "E2E Squat",
  ROWS: "E2E Row limit",
  PLANK: "E2E Plank",
  FUTURE: "E2E Future curl",
} as const;

// Previous session of the weighted exercises: 40x10, 40x8, 35x10 (best 40 kg).
const PREVIOUS_SETS = [
  { weightKg: 40, reps: 10 },
  { weightKg: 40, reps: 8 },
  { weightKg: 35, reps: 10 },
];

const youtubeId = (key: string) => `e2e${key}`.padEnd(11, "0").slice(0, 11);

// Dates are relative to the run date: only today and past days are loggable.
export const getE2eDates = (now = new Date()) => {
  const today = getTodayDate(TIME_ZONE, now);

  return {
    today,
    previous: addDays(today, -7),
    future: addDays(today, 1),
  };
};

export const seedE2eDatabase = async (url: string) => {
  if (!url.startsWith("file:")) {
    throw new Error("e2e seed only runs against a file: SQLite URL");
  }
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  const { today, previous, future } = getE2eDates();

  const [user] = await db
    .insert(schema.users)
    .values({ name: E2E_USER_NAME, nameKey: toNameKey(E2E_USER_NAME) })
    .returning();

  const addDay = async (
    date: string,
    exercises: { title: string; sets: number | null; reps: string }[],
  ) => {
    const [day] = await db
      .insert(schema.workoutDays)
      .values({ userId: user.id, date, title: "E2E" })
      .returning();
    const rows = await db
      .insert(schema.exercises)
      .values(
        exercises.map((exercise, position) => ({
          ...exercise,
          dayId: day.id,
          position,
          youtubeId: youtubeId(exercise.title.replace(/\W/g, "")),
        })),
      )
      .returning();

    return rows;
  };

  const previousExercises = await addDay(previous, [
    { title: E2E_EXERCISES.BENCH, sets: 3, reps: "8-12" },
    { title: E2E_EXERCISES.SQUAT, sets: 3, reps: "8-12" },
  ]);

  await db.insert(schema.exerciseSets).values(
    previousExercises.flatMap((exercise) =>
      PREVIOUS_SETS.map((set, position) => ({
        ...set,
        exerciseId: exercise.id,
        userId: user.id,
        position,
      })),
    ),
  );

  await addDay(today, [
    { title: E2E_EXERCISES.BENCH, sets: 3, reps: "8-12" },
    { title: E2E_EXERCISES.SQUAT, sets: 3, reps: "8-12" },
    { title: E2E_EXERCISES.ROWS, sets: 3, reps: "10" },
    { title: E2E_EXERCISES.PLANK, sets: 3, reps: "30s" },
  ]);
  await addDay(future, [{ title: E2E_EXERCISES.FUTURE, sets: 3, reps: "10" }]);

  client.close();
};
