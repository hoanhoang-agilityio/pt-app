"use client";

import { useEffect, useState } from "react";

import { SEARCH_LIMIT_MAX } from "@/features/exercise-library/constants/limits";
import type { MuscleKey } from "@/features/exercise-library/constants/muscles";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_PAGE_SIZE,
} from "@/features/exercise-library/constants/search";
import { useDebouncedValue } from "@/features/exercise-library/hooks/use-debounced-value";
import { searchExercises } from "@/features/exercise-library/services/exercise-actions";
import type {
  ExerciseRow,
  ExerciseSource,
} from "@/features/exercise-library/types/exercise";

interface Options {
  source: ExerciseSource;
  // Nothing is requested while false (a closed picker).
  isEnabled?: boolean;
}

interface Settled {
  key: string;
  rows: ExerciseRow[];
  hasError: boolean;
}

// Debounced search over the library. `isLoading` is derived: the last settled
// result belongs to another request key than the current one. Rows of the
// previous request stay visible meanwhile, so the list does not flash empty.
export const useExerciseSearch = ({ source, isEnabled = true }: Options) => {
  const [query, setQueryState] = useState("");
  const [muscle, setMuscleState] = useState<MuscleKey>();
  const [limit, setLimit] = useState(SEARCH_PAGE_SIZE);
  const [retryCount, setRetryCount] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const key = JSON.stringify([
    source,
    debouncedQuery,
    muscle,
    limit,
    retryCount,
  ]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    let isCurrent = true;

    searchExercises({ q: debouncedQuery, muscle, source, limit })
      .then((result) => {
        if (isCurrent) {
          setSettled({
            key,
            rows: result.status === "success" ? result.rows : [],
            hasError: result.status !== "success",
          });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setSettled({ key, rows: [], hasError: true });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [isEnabled, key, debouncedQuery, muscle, source, limit]);

  return {
    query,
    setQuery: (value: string) => {
      setQueryState(value);
      setLimit(SEARCH_PAGE_SIZE);
    },
    muscle,
    setMuscle: (value: MuscleKey | undefined) => {
      setMuscleState(value);
      setLimit(SEARCH_PAGE_SIZE);
    },
    rows: settled?.rows ?? [],
    isLoading: isEnabled && settled?.key !== key,
    hasError: settled?.key === key && settled.hasError,
    // A full page may mean more rows behind it.
    canShowMore:
      settled?.key === key &&
      !settled.hasError &&
      settled.rows.length >= limit &&
      limit < SEARCH_LIMIT_MAX,
    showMore: () =>
      setLimit((current) =>
        Math.min(current + SEARCH_PAGE_SIZE, SEARCH_LIMIT_MAX),
      ),
    // Search again with the same terms, e.g. after saving an exercise.
    refresh: () => setRetryCount((count) => count + 1),
  };
};
