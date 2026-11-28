"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CATALOG_ONLY_GROUPS,
  EMPTY_FILTERS,
  type ExerciseFilters,
  type FilterGroup,
} from "@/features/exercise-library/constants/filters";
import { SEARCH_LIMIT_MAX } from "@/features/exercise-library/constants/limits";
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
import {
  clearedFilters,
  hasFilters,
  toggleFilterKey,
} from "@/features/exercise-library/utils/exercise-filters";

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

const clearedGroups = (groups: readonly FilterGroup[]) =>
  Object.fromEntries(groups.map((group) => [group, []]));

// Debounced search over the library. `isLoading` is derived: the last settled
// result belongs to another request key than the current one. Rows of the
// previous request stay visible meanwhile, so the list does not flash empty.
export const useExerciseSearch = ({ source, isEnabled = true }: Options) => {
  const [query, setQueryState] = useState("");
  const [selected, setFiltersState] = useState<ExerciseFilters>(EMPTY_FILTERS);
  const [limit, setLimit] = useState(SEARCH_PAGE_SIZE);
  const [retryCount, setRetryCount] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  // The own-exercises list has no level or category: those selections stay in
  // state (they come back on the other list) but are neither shown nor sent.
  const filters = useMemo(
    () =>
      source === "mine"
        ? { ...selected, ...clearedGroups(CATALOG_ONLY_GROUPS) }
        : selected,
    [source, selected],
  );
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const key = JSON.stringify([
    source,
    debouncedQuery,
    filters,
    limit,
    retryCount,
  ]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    let isCurrent = true;

    searchExercises({ q: debouncedQuery, filters, source, limit })
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
  }, [isEnabled, key, debouncedQuery, filters, source, limit]);

  return {
    query,
    setQuery: (value: string) => {
      setQueryState(value);
      setLimit(SEARCH_PAGE_SIZE);
    },
    filters,
    hasFilters: hasFilters(filters),
    toggleFilter: (group: FilterGroup, key: string) => {
      setFiltersState((current) => toggleFilterKey(current, group, key));
      setLimit(SEARCH_PAGE_SIZE);
    },
    clearFilters: () => {
      setFiltersState(clearedFilters());
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
