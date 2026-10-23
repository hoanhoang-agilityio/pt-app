import type {
  ActivityItem,
  PersonalBestActivity,
} from "@/features/dashboard/types/dashboard";
import { toBestSet } from "@/features/members/utils/progress";
import {
  getBestSet,
  isPersonalBest,
  type SetSession,
} from "@/features/workouts/utils/sets";

// One exercise with logged sets inside the activity window.
export interface ActivitySession extends SetSession {
  userName: string;
  exerciseTitle: string;
  // Epoch ms of the session's latest saved set.
  occurredAt: number;
}

// Window sessions whose sets are a personal best against `history` (D6, D8,
// D11). `history` may hold extra sessions (other users, links or later dates,
// even the window itself): only the same user + link on earlier dates count.
export const findPersonalBests = (
  window: ActivitySession[],
  history: SetSession[],
): PersonalBestActivity[] =>
  window.flatMap((session) => {
    const key = {
      userId: session.userId,
      youtubeId: session.youtubeId,
      date: session.date,
    };

    if (!isPersonalBest(session.sets, history, key)) {
      return [];
    }

    const best = getBestSet(session.sets);
    const previousBest = getBestSet(
      history
        .filter(
          (earlier) =>
            earlier.userId === key.userId &&
            earlier.youtubeId === key.youtubeId &&
            earlier.date < key.date,
        )
        .flatMap((earlier) => earlier.sets),
    );

    // isPersonalBest already guarantees both exist; this narrows the types.
    if (best === null || previousBest === null) {
      return [];
    }

    return [
      {
        kind: "personalBest",
        id: session.exerciseId,
        userId: session.userId,
        userName: session.userName,
        exerciseTitle: session.exerciseTitle,
        date: session.date,
        occurredAt: session.occurredAt,
        best: toBestSet(best),
        previousBest: toBestSet(previousBest),
      },
    ];
  });

// Newest first, at most `limit` items. On the same timestamp a record comes
// before the completion it usually arrives with (Q4).
export const mergeActivity = (
  completions: ActivityItem[],
  records: ActivityItem[],
  limit: number,
): ActivityItem[] =>
  [...records, ...completions]
    .sort((a, b) => b.occurredAt - a.occurredAt)
    .slice(0, limit);
