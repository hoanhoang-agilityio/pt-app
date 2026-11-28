"use client";

import clsx from "clsx";
import { Check, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Input } from "@/components/common/Input";
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/constants/styles";
import {
  type ExerciseFilters,
  FILTER_GROUPS,
  FILTER_OPTIONS,
  type FilterGroup,
} from "@/features/exercise-library/constants/filters";
import { useFilterLabel } from "@/features/exercise-library/hooks/use-filter-label";
import { hasFilters } from "@/features/exercise-library/utils/exercise-filters";
import { toNameKey } from "@/utils/name";

interface ExerciseFilterPanelProps {
  filters: ExerciseFilters;
  onToggle: (group: FilterGroup, key: string) => void;
  onClear: () => void;
  // "sheet": inside a bottom sheet that scrolls as a whole, with a done button.
  // "popover": a box of its own height that scrolls its list.
  variant: "sheet" | "popover";
  // Groups left out, e.g. the ones that cannot match the current list.
  hiddenGroups?: readonly FilterGroup[];
  onDone?: () => void;
}

const OPTION =
  "inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border px-4 text-left text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none";
const OPTION_SELECTED = "border-accent bg-accent text-accent-fg";
const OPTION_IDLE = "border-line bg-surface text-fg active:bg-line/40";

// The content of the filter box: a search field over the options, the options
// grouped as multi-select chips, and clear all (plus done on a phone).
export const ExerciseFilterPanel = ({
  filters,
  onToggle,
  onClear,
  variant,
  hiddenGroups = [],
  onDone,
}: ExerciseFilterPanelProps) => {
  const t = useTranslations("exerciseLibrary.filter");
  const labelOf = useFilterLabel();
  const [query, setQuery] = useState("");
  const words = toNameKey(query).split(" ").filter(Boolean);
  const groups = FILTER_GROUPS.filter((group) => !hiddenGroups.includes(group))
    .map((group) => ({
      group,
      options: FILTER_OPTIONS[group]
        .map((key) => ({ key, label: labelOf(group, key) }))
        .filter(({ label }) => {
          const name = toNameKey(label);

          return words.every((word) => name.includes(word));
        }),
    }))
    .filter(({ options }) => options.length > 0);
  const isPopover = variant === "popover";

  return (
    <div
      className={clsx("flex min-h-0 flex-col", isPopover ? "gap-3" : "gap-4")}
    >
      <Input
        type="search"
        clearable
        leadingIcon={<Search className="size-5" aria-hidden />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        // Enter in a field must not submit a form the box sits inside.
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchLabel")}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        enterKeyHint="search"
        wrapperClassName={clsx(!isPopover && "sticky top-0 z-10 bg-bg pb-1")}
      />
      <div
        className={clsx(
          "min-h-0 space-y-5",
          isPopover && "-mx-1 flex-1 overflow-y-auto px-1 pb-1",
        )}
      >
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("noMatch")}</p>
        ) : (
          groups.map(({ group, options }) => (
            <section
              key={group}
              aria-labelledby={`filter-group-${group}`}
              className="space-y-2"
            >
              <h3
                id={`filter-group-${group}`}
                className="text-sm font-semibold text-muted"
              >
                {t(`groups.${group}`)}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {options.map(({ key, label }) => {
                  const isSelected = (
                    filters[group] as readonly string[]
                  ).includes(key);

                  return (
                    <li key={key} className="max-w-full">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onToggle(group, key)}
                        className={clsx(
                          OPTION,
                          isSelected ? OPTION_SELECTED : OPTION_IDLE,
                        )}
                      >
                        {isSelected && (
                          <Check className="size-4 shrink-0" aria-hidden />
                        )}
                        <span className="min-w-0 break-words">{label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
      <div
        className={clsx(
          "flex gap-2",
          isPopover
            ? "justify-end border-t border-line pt-3"
            : "sticky bottom-0 z-10 bg-bg pt-2",
        )}
      >
        <button
          type="button"
          onClick={onClear}
          disabled={!hasFilters(filters)}
          className={clsx(
            BUTTON_SECONDARY,
            isPopover ? "min-h-10 px-4 text-sm" : "flex-1",
          )}
        >
          {t("clearAll")}
        </button>
        {!isPopover && (
          <button
            type="button"
            onClick={onDone}
            className={clsx(BUTTON_PRIMARY, "flex-1")}
          >
            {t("done")}
          </button>
        )}
      </div>
    </div>
  );
};
