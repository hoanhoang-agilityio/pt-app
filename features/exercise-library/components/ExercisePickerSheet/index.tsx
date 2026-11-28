"use client";

import { History, Search, SearchX, TextCursorInput } from "lucide-react";
import { useTranslations } from "next-intl";

import { BottomSheet } from "@/components/common/BottomSheet";
import { Input } from "@/components/common/Input";
import { Skeleton } from "@/components/common/Skeleton";
import { BUTTON_SECONDARY, SECTION_TITLE } from "@/constants/styles";
import { ExerciseRowItem } from "@/features/exercise-library/components/ExerciseRowItem";
import { MuscleFilterChips } from "@/features/exercise-library/components/MuscleFilterChips";
import { EXERCISE_NAME_MAX } from "@/features/exercise-library/constants/limits";
import { useExerciseSearch } from "@/features/exercise-library/hooks/use-exercise-search";
import type {
  ExerciseMuscles,
  ExerciseRow,
} from "@/features/exercise-library/types/exercise";
import { toNameKey } from "@/utils/name";

// What the note form receives: the name to store, and the library link when
// the name came from the library (null for typed or recent names).
export interface PickedExercise {
  name: string;
  ref: string | null;
  muscles: ExerciseMuscles | null;
}

interface ExercisePickerSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPick: (picked: PickedExercise) => void;
  // Names this admin used in earlier notes, most recent first.
  recentNames: string[];
}

const RECENT_MAX = 8;

const ROW =
  "flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition active:bg-line/40 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none";

const PickerBody = ({
  onPick,
  recentNames,
}: Pick<ExercisePickerSheetProps, "onPick" | "recentNames">) => {
  const t = useTranslations("exerciseLibrary");
  const search = useExerciseSearch({ source: "all" });
  const typed = search.query.trim();
  const isBrowsing = typed === "" && search.muscle === undefined;
  const recent = isBrowsing ? recentNames.slice(0, RECENT_MAX) : [];

  const pickRow = (row: ExerciseRow) =>
    onPick({
      name: row.name,
      ref: row.ref,
      muscles: { primary: row.primary, secondary: row.secondary },
    });
  const pickText = (name: string) => onPick({ name, ref: null, muscles: null });

  // Enter keeps what was typed, unless it is exactly a library name.
  const submit = () => {
    if (typed === "") {
      return;
    }
    const exact = search.rows.find(
      (row) => toNameKey(row.name) === toNameKey(typed),
    );

    return exact ? pickRow(exact) : pickText(typed);
  };

  return (
    <div className="space-y-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="sticky top-0 z-10 -mx-4 space-y-2 bg-bg px-4 pb-2"
      >
        <Input
          type="search"
          clearable
          autoFocus
          leadingIcon={<Search className="size-5" aria-hidden />}
          value={search.query}
          onChange={(event) => search.setQuery(event.target.value)}
          placeholder={t("picker.searchPlaceholder")}
          aria-label={t("picker.searchLabel")}
          // The query can be saved as the name: keep it within the limit.
          maxLength={EXERCISE_NAME_MAX}
          enterKeyHint="done"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
        />
        <MuscleFilterChips
          value={search.muscle}
          onChange={search.setMuscle}
          label={t("picker.filterLabel")}
        />
      </form>
      {typed !== "" && (
        <button type="button" onClick={() => pickText(typed)} className={ROW}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] text-accent">
            <TextCursorInput className="size-5" aria-hidden />
          </span>
          <span className="grid min-w-0">
            <span className="truncate font-semibold text-fg">
              {t("picker.useName", { name: typed })}
            </span>
            <span className="text-xs text-muted">
              {t("picker.useNameHint")}
            </span>
          </span>
        </button>
      )}
      {recent.length > 0 && (
        <section className="space-y-2">
          <h3 className={SECTION_TITLE}>{t("picker.recent")}</h3>
          <ul className="flex flex-wrap gap-2">
            {recent.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => pickText(name)}
                  className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-medium text-fg transition active:bg-line/40"
                >
                  <History className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="truncate">{name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {search.hasError ? (
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-muted">{t("picker.loadFailed")}</p>
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
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[4.5rem] w-full rounded-2xl" />
          ))}
        </div>
      ) : search.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-muted">
          <SearchX className="size-8" aria-hidden />
          <p className="text-sm">{t("picker.noResult")}</p>
        </div>
      ) : (
        <section className="space-y-2">
          <h3 className={SECTION_TITLE}>{t("picker.results")}</h3>
          <ul className="space-y-2" aria-busy={search.isLoading}>
            {search.rows.map((row) => (
              <ExerciseRowItem
                key={row.ref}
                exercise={row}
                onSelect={pickRow}
                actionLabel={row.name}
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
        </section>
      )}
    </div>
  );
};

// Opens from the exercise field of the note form: search the library, or keep
// the typed name. The body remounts on every open, so a new pick starts clean.
export const ExercisePickerSheet = ({
  isOpen,
  onOpenChange,
  onPick,
  recentNames,
}: ExercisePickerSheetProps) => {
  const t = useTranslations("exerciseLibrary.picker");

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t("title")}
      // Covers the note form it opens over, and keeps its size while results
      // load instead of growing and shrinking with them.
      isTall
      // The search field takes focus itself; the sheet's default would focus
      // the first control it finds.
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      <PickerBody
        onPick={(picked) => {
          onPick(picked);
          onOpenChange(false);
        }}
        recentNames={recentNames}
      />
    </BottomSheet>
  );
};
