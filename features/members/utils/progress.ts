import type {
  BestSet,
  ExerciseProgressRow,
  ProgressTrend,
} from "@/features/members/types/progress";
import {
  compareSets,
  getBestSet,
  type LoggedSet,
  type SetSession,
} from "@/features/workouts/utils/sets";

export interface ProgressSession extends SetSession {
  title: string;
}

export const toBestSet = (set: LoggedSet & BestSet): BestSet => ({
  weightKg: set.weightKg,
  reps: set.reps,
});

const getTrend = (
  weekBest: BestSet,
  previousBest: BestSet | null,
): ProgressTrend => {
  if (previousBest === null) {
    return "first";
  }
  const diff = compareSets(weekBest, previousBest);

  if (diff > 0) {
    return "up";
  }
  return diff < 0 ? "down" : "same";
};

const isLater = (a: ProgressSession, b: ProgressSession) =>
  a.date > b.date || (a.date === b.date && a.exerciseId > b.exerciseId);

// "Tiến bộ" rows for one trainee's sessions (the caller filters by user).
// Per link: the selected week's best vs the best before the week (F4); links
// without a weighted set in the week are left out (F6, OQ2); no earlier
// weighted set means "first" (F6, D11). Sessions after the week are ignored.
// Newest first.
export const buildExerciseProgress = (
  sessions: ProgressSession[],
  weekStart: string,
  weekEnd: string,
): ExerciseProgressRow[] => {
  const byLink = new Map<string, ProgressSession[]>();

  for (const session of sessions) {
    if (session.date > weekEnd) {
      continue;
    }
    byLink.set(session.youtubeId, [
      ...(byLink.get(session.youtubeId) ?? []),
      session,
    ]);
  }

  const rows: ExerciseProgressRow[] = [];

  for (const [youtubeId, linkSessions] of byLink) {
    const weekSessions = linkSessions.filter(
      (session) => session.date >= weekStart && session.sets.length > 0,
    );
    const weekBest = getBestSet(
      weekSessions.flatMap((session) => session.sets),
    );

    if (weekBest === null) {
      continue;
    }

    const earlierBest = getBestSet(
      linkSessions
        .filter((session) => session.date < weekStart)
        .flatMap((session) => session.sets),
    );
    const previousBest = earlierBest && toBestSet(earlierBest);
    const latest = linkSessions.reduce((a, b) => (isLater(b, a) ? b : a));
    const lastDate = weekSessions.reduce(
      (date, session) => (session.date > date ? session.date : date),
      weekStart,
    );

    rows.push({
      youtubeId,
      title: latest.title,
      weekBest: toBestSet(weekBest),
      previousBest,
      changeKg: previousBest && weekBest.weightKg - previousBest.weightKg,
      trend: getTrend(weekBest, previousBest),
      lastDate,
    });
  }

  return rows.sort(
    (a, b) =>
      b.lastDate.localeCompare(a.lastDate) || a.title.localeCompare(b.title),
  );
};
