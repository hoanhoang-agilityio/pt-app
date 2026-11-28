import {
  EMPTY_FILTERS,
  type ExerciseFilters,
  FILTER_GROUPS,
  FILTER_OPTIONS,
  type FilterGroup,
} from "@/features/exercise-library/constants/filters";

export const countFilters = (filters: ExerciseFilters) =>
  FILTER_GROUPS.reduce((total, group) => total + filters[group].length, 0);

export const hasFilters = (filters: ExerciseFilters) =>
  countFilters(filters) > 0;

// Adds the key to its group, or removes it when it is already there. Keys stay
// in the order of the option list, so the same selection always looks the same
// (and makes the same request key) whatever order it was picked in. A key that
// is not an option of the group changes nothing.
export const toggleFilterKey = (
  filters: ExerciseFilters,
  group: FilterGroup,
  key: string,
): ExerciseFilters => {
  const options = FILTER_OPTIONS[group];

  if (!options.includes(key)) {
    return filters;
  }
  const current: readonly string[] = filters[group];
  const next = current.includes(key)
    ? current.filter((entry) => entry !== key)
    : [...current, key];

  return {
    ...filters,
    [group]: options.filter((entry) => next.includes(entry)),
  };
};

export const clearedFilters = (): ExerciseFilters => ({ ...EMPTY_FILTERS });
