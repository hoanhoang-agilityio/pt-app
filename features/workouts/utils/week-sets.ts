import type {
  ScheduleDay,
  ScheduleDayWithSets,
} from "@/features/workouts/types/workout";
import {
  getPreviousSession,
  isPersonalBest,
  type SetSession,
} from "@/features/workouts/utils/sets";

// One logged set joined with its exercise's link and day (KAN-29).
export interface SetRow {
  exerciseId: number;
  userId: number;
  youtubeId: string;
  date: string;
  position: number;
  weightKg: number | null;
  reps: number;
}

// One session per exercise, sets ordered by position.
export const groupSetSessions = (rows: SetRow[]): SetSession[] => {
  const sessions = new Map<number, SetSession>();
  const byPosition = [...rows].sort((a, b) => a.position - b.position);

  for (const row of byPosition) {
    let session = sessions.get(row.exerciseId);

    if (!session) {
      session = {
        userId: row.userId,
        youtubeId: row.youtubeId,
        date: row.date,
        exerciseId: row.exerciseId,
        sets: [],
      };
      sessions.set(row.exerciseId, session);
    }

    session.sets.push({ weightKg: row.weightKg, reps: row.reps });
  }

  return [...sessions.values()];
};

// Attaches each exercise's own sets, the previous session's sets (hints by row
// position, E7) and the record flag (E6) to a week from getWeekSchedule.
export const attachSetsToWeek = (
  days: ScheduleDay[],
  userId: number,
  sessions: SetSession[],
): ScheduleDayWithSets[] => {
  const byExercise = new Map(
    sessions.map((session) => [session.exerciseId, session]),
  );

  return days.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => {
      const key = { userId, youtubeId: exercise.youtubeId, date: day.date };
      const loggedSets = byExercise.get(exercise.id)?.sets ?? [];

      return {
        ...exercise,
        loggedSets,
        previousSets: getPreviousSession(sessions, key)?.sets ?? [],
        isPersonalBest: isPersonalBest(loggedSets, sessions, key),
      };
    }),
  }));
};
