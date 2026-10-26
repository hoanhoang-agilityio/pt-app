import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { TIME_ZONE } from "@/constants/time";
import * as schema from "@/db/schema";
import { hashPassword } from "@/services/password";
import { toNameKey } from "@/utils/name";
import { toUsernameKey } from "@/utils/username";
import { addDays, getTodayDate } from "@/utils/week";

import {
  E2E_ADMIN,
  E2E_EMPTY_NAME,
  E2E_LIFTER_NAME,
  E2E_USER_NAME,
} from "./config";

// Exercise titles the spec looks up by name.
export const E2E_EXERCISES = {
  BENCH: "E2E Bench press",
  SQUAT: "E2E Squat",
  ROWS: "E2E Row limit",
  PLANK: "E2E Plank",
  // Timed, but sets were logged before the PT made it timed (KAN-44).
  TIMED_LOGGED: "E2E Timed with sets",
  FUTURE: "E2E Future curl",
} as const;

// Exercises of the PT specs (E2E_LIFTER_NAME). SQUAT beats last week (record),
// PRESS is logged for the first time, CURL has no sets, TEMP is deleted.
export const E2E_PT_EXERCISES = {
  SQUAT: "E2E PT Squat",
  PRESS: "E2E PT Press",
  CURL: "E2E PT Curl",
  // No sets; the delete test removes it.
  TEMP: "E2E PT Temp",
  // Has sets; the link-change test (KAN-39) replaces its video.
  LINK: "E2E PT Link",
  // No sets when seeded; the stale-page delete test (KAN-51) logs one itself.
  STALE: "E2E PT Stale",
} as const;

// The video the link-change test switches to.
export const E2E_NEW_VIDEO_ID = "dQw4w9WgXcQ";

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
    userId: number,
    date: string,
    exercises: { title: string; sets: number | null; reps: string }[],
  ) => {
    const [day] = await db
      .insert(schema.workoutDays)
      .values({ userId, date, title: "E2E" })
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

  const previousExercises = await addDay(user.id, previous, [
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

  const todayExercises = await addDay(user.id, today, [
    { title: E2E_EXERCISES.BENCH, sets: 3, reps: "8-12" },
    { title: E2E_EXERCISES.SQUAT, sets: 3, reps: "8-12" },
    { title: E2E_EXERCISES.ROWS, sets: 3, reps: "10" },
    { title: E2E_EXERCISES.PLANK, sets: 3, reps: "30s" },
    { title: E2E_EXERCISES.TIMED_LOGGED, sets: 2, reps: "30s" },
  ]);
  const timedLogged = todayExercises.find(
    (exercise) => exercise.title === E2E_EXERCISES.TIMED_LOGGED,
  );

  if (!timedLogged) {
    throw new Error("e2e seed: missing timed exercise with sets");
  }
  await db.insert(schema.exerciseSets).values(
    [
      { weightKg: 20, reps: 30 },
      { weightKg: null, reps: 25 },
    ].map((set, position) => ({
      ...set,
      exerciseId: timedLogged.id,
      userId: user.id,
      position,
    })),
  );
  await addDay(user.id, future, [
    { title: E2E_EXERCISES.FUTURE, sets: 3, reps: "10" },
  ]);

  // PT views: an admin account, a lifter with two sessions and an empty trainee.
  await db.insert(schema.admins).values({
    username: E2E_ADMIN.username,
    usernameKey: toUsernameKey(E2E_ADMIN.username),
    passwordHash: await hashPassword(E2E_ADMIN.password),
  });
  const [lifter] = await db
    .insert(schema.users)
    .values({
      name: E2E_LIFTER_NAME,
      nameKey: toNameKey(E2E_LIFTER_NAME),
    })
    .returning();

  await db
    .insert(schema.users)
    .values({ name: E2E_EMPTY_NAME, nameKey: toNameKey(E2E_EMPTY_NAME) });

  const previousDay = await addDay(lifter.id, previous, [
    { title: E2E_PT_EXERCISES.SQUAT, sets: 2, reps: "8-10" },
  ]);
  const todayDay = await addDay(lifter.id, today, [
    { title: E2E_PT_EXERCISES.SQUAT, sets: 2, reps: "8-10" },
    { title: E2E_PT_EXERCISES.PRESS, sets: 1, reps: "10" },
    { title: E2E_PT_EXERCISES.CURL, sets: 3, reps: "12" },
    { title: E2E_PT_EXERCISES.TEMP, sets: 3, reps: "12" },
    { title: E2E_PT_EXERCISES.LINK, sets: 1, reps: "10" },
    { title: E2E_PT_EXERCISES.STALE, sets: 1, reps: "10" },
  ]);
  const findExercise = (rows: typeof todayDay, title: string) => {
    const row = rows.find((exercise) => exercise.title === title);

    if (!row) {
      throw new Error(`e2e seed: missing exercise ${title}`);
    }

    return row;
  };
  const previousSquat = findExercise(previousDay, E2E_PT_EXERCISES.SQUAT);
  const squat = findExercise(todayDay, E2E_PT_EXERCISES.SQUAT);
  const press = findExercise(todayDay, E2E_PT_EXERCISES.PRESS);
  const link = findExercise(todayDay, E2E_PT_EXERCISES.LINK);

  const ptSets = [
    // Last week: best 50 kg x 10. This week: 55 kg x 8 beats it by 5 kg.
    { exercise: previousSquat, position: 0, weightKg: 50, reps: 10 },
    { exercise: previousSquat, position: 1, weightKg: 50, reps: 8 },
    { exercise: squat, position: 0, weightKg: 55, reps: 8 },
    { exercise: squat, position: 1, weightKg: 50, reps: 10 },
    // First ever weighted set: "Lần đầu", not a record (D11).
    { exercise: press, position: 0, weightKg: 30, reps: 10 },
    // Only for the link-change test; it is wiped there.
    { exercise: link, position: 0, weightKg: 20, reps: 12 },
  ];

  await db.insert(schema.exerciseSets).values(
    ptSets.map(({ exercise, ...set }) => ({
      ...set,
      exerciseId: exercise.id,
      userId: lifter.id,
    })),
  );
  // The completion id equals the squat's id, which is also the id of its
  // personal-best activity entry: a key of just `id` would collide (C8, F2).
  await db.insert(schema.exerciseCompletions).values({
    id: squat.id,
    exerciseId: squat.id,
    userId: lifter.id,
    completedAt: new Date(),
  });

  client.close();
};
