"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  type ExerciseFilters,
  FILTER_GROUPS,
  type FilterGroup,
} from "@/features/exercise-library/constants/filters";
import { useFilterLabel } from "@/features/exercise-library/hooks/use-filter-label";
import { hasFilters } from "@/features/exercise-library/utils/exercise-filters";

interface ActiveFilterChipsProps {
  filters: ExerciseFilters;
  onRemove: (group: FilterGroup, key: string) => void;
  onClear: () => void;
}

// The selected filters, each removable. Wraps onto more lines, never scrolls.
export const ActiveFilterChips = ({
  filters,
  onRemove,
  onClear,
}: ActiveFilterChipsProps) => {
  const t = useTranslations("exerciseLibrary.filter");
  const labelOf = useFilterLabel();

  if (!hasFilters(filters)) {
    return null;
  }
  return (
    <ul aria-label={t("active")} className="flex flex-wrap items-center gap-2">
      {FILTER_GROUPS.flatMap((group) =>
        (filters[group] as readonly string[]).map((key) => {
          const name = labelOf(group, key);

          return (
            <li key={`${group}:${key}`} className="max-w-full">
              <button
                type="button"
                onClick={() => onRemove(group, key)}
                aria-label={t("remove", { name })}
                className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-accent bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] pr-2.5 pl-4 text-sm font-semibold text-fg transition active:bg-line/40 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
              >
                <span className="min-w-0 break-words">{name}</span>
                <X className="size-4 shrink-0 text-muted" aria-hidden />
              </button>
            </li>
          );
        }),
      )}
      <li>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-accent transition active:bg-line/40 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
        >
          {t("clearAll")}
        </button>
      </li>
    </ul>
  );
};
