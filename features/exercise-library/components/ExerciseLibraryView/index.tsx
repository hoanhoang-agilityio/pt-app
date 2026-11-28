"use client";

import clsx from "clsx";
import { Plus, Search, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Input } from "@/components/common/Input";
import { Skeleton } from "@/components/common/Skeleton";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD } from "@/constants/styles";
import { ExerciseDetailSheet } from "@/features/exercise-library/components/ExerciseDetailSheet";
import { ExerciseFormSheet } from "@/features/exercise-library/components/ExerciseFormSheet";
import { ExerciseRowItem } from "@/features/exercise-library/components/ExerciseRowItem";
import { MuscleFilterChips } from "@/features/exercise-library/components/MuscleFilterChips";
import { useExerciseSearch } from "@/features/exercise-library/hooks/use-exercise-search";
import type {
  ExerciseDetail,
  ExerciseRow,
} from "@/features/exercise-library/types/exercise";

type Tab = "mine" | "library";

interface ExerciseLibraryViewProps {
  initialTab: Tab;
}

const TAB_BASE =
  "min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold transition";

// The library page: own exercises and the built-in catalog, one search box and
// one muscle filter for both.
export const ExerciseLibraryView = ({
  initialTab,
}: ExerciseLibraryViewProps) => {
  const t = useTranslations("exerciseLibrary");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selected, setSelected] = useState<ExerciseRow | null>(null);
  // Bumped after a save: remounts the detail sheet so it drops the detail it
  // loaded before the edit instead of showing it until the refetch lands.
  const [detailVersion, setDetailVersion] = useState(0);
  const [form, setForm] = useState<{
    isOpen: boolean;
    exercise: ExerciseDetail | null;
  }>({ isOpen: false, exercise: null });
  const search = useExerciseSearch({
    source: tab === "mine" ? "mine" : "builtin",
  });
  const isFiltered = search.query.trim() !== "" || search.muscle !== undefined;

  const openForm = (exercise: ExerciseDetail | null) =>
    setForm({ isOpen: true, exercise });

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => openForm(null)}
        className={`${BUTTON_PRIMARY} w-full`}
      >
        <Plus className="size-5" aria-hidden />
        {t("add")}
      </button>
      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="flex gap-1 rounded-xl bg-line/50 p-1"
      >
        {(
          [
            ["mine", t("tabMine")],
            ["library", t("tabLibrary")],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={clsx(
              TAB_BASE,
              tab === value ? "bg-surface text-fg shadow-sm" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <Input
        type="search"
        clearable
        leadingIcon={<Search className="size-5" aria-hidden />}
        value={search.query}
        onChange={(event) => search.setQuery(event.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchLabel")}
        autoCapitalize="none"
        autoCorrect="off"
      />
      <MuscleFilterChips
        value={search.muscle}
        onChange={search.setMuscle}
        label={t("filterLabel")}
      />
      <div aria-live="polite" className="sr-only">
        {!search.isLoading && t("resultCount", { count: search.rows.length })}
      </div>
      {search.hasError ? (
        <div className={`${CARD} space-y-3 px-6 py-8 text-center`}>
          <p className="text-sm text-fg">{t("loadFailed")}</p>
          <button
            type="button"
            onClick={search.refresh}
            className={BUTTON_SECONDARY}
          >
            {t("retry")}
          </button>
        </div>
      ) : search.rows.length === 0 && search.isLoading ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-[4.5rem] w-full rounded-2xl" />
          ))}
        </div>
      ) : search.rows.length === 0 ? (
        <div
          className={`${CARD} flex flex-col items-center px-6 py-10 text-center`}
        >
          <SearchX className="size-10 text-muted" aria-hidden />
          {tab === "mine" && !isFiltered ? (
            <>
              <p className="mt-3 font-semibold text-fg">
                {t("emptyMine.title")}
              </p>
              <p className="mt-1 text-sm text-muted">{t("emptyMine.hint")}</p>
              <button
                type="button"
                onClick={() => openForm(null)}
                className={`${BUTTON_SECONDARY} mt-4`}
              >
                {t("emptyMine.action")}
              </button>
            </>
          ) : (
            <p className="mt-3 font-semibold text-fg">{t("noResult")}</p>
          )}
        </div>
      ) : (
        <>
          <ul
            className={clsx(
              "space-y-2 transition-opacity",
              search.isLoading && "opacity-60",
            )}
          >
            {search.rows.map((exercise) => (
              <ExerciseRowItem
                key={exercise.ref}
                exercise={exercise}
                onSelect={setSelected}
                actionLabel={t("openDetail", { name: exercise.name })}
              />
            ))}
          </ul>
          {search.canShowMore && (
            <button
              type="button"
              onClick={search.showMore}
              className={`${BUTTON_SECONDARY} w-full`}
            >
              {t("showMore")}
            </button>
          )}
        </>
      )}
      <ExerciseDetailSheet
        key={detailVersion}
        exercise={selected}
        onClose={() => setSelected(null)}
        onEdit={(exercise) => {
          setSelected(null);
          openForm(exercise);
        }}
      />
      <ExerciseFormSheet
        isOpen={form.isOpen}
        onOpenChange={(isOpen) =>
          setForm((current) => ({ ...current, isOpen }))
        }
        exercise={form.exercise}
        onSaved={() => {
          search.refresh();
          setSelected(null);
          setDetailVersion((version) => version + 1);
        }}
      />
    </div>
  );
};
