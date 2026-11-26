"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { IconButton } from "@/components/common/IconButton";
import { Input } from "@/components/common/Input";
import { BUTTON_SECONDARY, FIELD_ERROR } from "@/constants/styles";
import {
  DURATION_MAX_SEC,
  REPS_MAX,
  SET_NOTE_MAX,
  SETS_PER_ITEM_MAX,
} from "@/features/training-notes/constants/limits";
import type { SetDraft } from "@/features/training-notes/utils/note-draft";
import { cn } from "@/utils/cn";

interface SetRowsProps {
  // Prefix of the field ids of this exercise.
  idPrefix: string;
  sets: SetDraft[];
  onChangeSet: (setKey: number, changes: Partial<SetDraft>) => void;
  onAddSet: () => void;
  onRemoveSet: (setKey: number) => void;
}

// "#" | Kg | reps-or-seconds (+ unit toggle) | remove, with a one-line note
// under each set.
export const SetRows = ({
  idPrefix,
  sets,
  onChangeSet,
  onAddSet,
  onRemoveSet,
}: SetRowsProps) => {
  const t = useTranslations("trainingNotes.form");
  const isAtLimit = sets.length >= SETS_PER_ITEM_MAX;

  return (
    <div className="space-y-1">
      <div
        aria-hidden
        className="grid grid-cols-[1.5rem_1fr_1.6fr_2.25rem] gap-x-2 text-xs font-medium text-muted"
      >
        <span>{t("setHeader")}</span>
        <span>{t("kgPlaceholder")}</span>
        <span>{t("unitLabel")}</span>
        <span />
      </div>
      {sets.map((set, index) => {
        const n = index + 1;
        const id = `${idPrefix}-set-${set.key}`;
        const isSeconds = set.unit === "seconds";
        const unitLabel = t(isSeconds ? "unitSeconds" : "unitReps");
        const otherLabel = t(isSeconds ? "unitReps" : "unitSeconds");
        const noteText = set.note.trim();

        return (
          <div key={set.key} className="space-y-0.5">
            <div className="grid grid-cols-[1.5rem_1fr_1.6fr_2.25rem] items-center gap-x-2">
              <span
                aria-hidden
                className="text-sm font-semibold text-muted tabular-nums"
              >
                {n}
              </span>
              <Input
                inputMode="decimal"
                value={set.kg}
                onChange={(event) =>
                  onChangeSet(set.key, { kg: event.target.value })
                }
                placeholder={t("kgPlaceholder")}
                aria-label={t("kgLabel", { n })}
                autoComplete="off"
                enterKeyHint="next"
              />
              <div className="relative">
                <Input
                  inputMode="numeric"
                  value={set.value}
                  onChange={(event) =>
                    onChangeSet(set.key, { value: event.target.value })
                  }
                  placeholder={unitLabel}
                  aria-label={t(isSeconds ? "valueSeconds" : "valueReps", {
                    n,
                  })}
                  maxLength={
                    String(isSeconds ? DURATION_MAX_SEC : REPS_MAX).length
                  }
                  autoComplete="off"
                  enterKeyHint="next"
                  className="pr-14"
                />
                <button
                  type="button"
                  onClick={() => {
                    const unit = isSeconds ? "reps" : "seconds";
                    const max = unit === "reps" ? REPS_MAX : DURATION_MAX_SEC;
                    const value = Number(set.value.trim());

                    // A value outside the new unit's range would be rejected
                    // on save: clear it instead.
                    onChangeSet(
                      set.key,
                      value > max ? { unit, value: "" } : { unit },
                    );
                  }}
                  aria-label={t("unitToggle", {
                    n,
                    unit: unitLabel,
                    other: otherLabel,
                  })}
                  className="absolute inset-y-1.5 right-1.5 rounded-lg bg-accent/15 px-2 text-xs font-semibold text-accent"
                >
                  {unitLabel}
                </button>
              </div>
              <IconButton
                label={t("removeSet", { n })}
                size="sm"
                disabled={sets.length < 2}
                onClick={() => onRemoveSet(set.key)}
              >
                <X className="size-4" aria-hidden />
              </IconButton>
            </div>
            <div className="pl-8">
              {set.noteOpen ? (
                <div className="flex items-center gap-2">
                  <Input
                    id={`${id}-note`}
                    autoFocus
                    value={set.note}
                    onChange={(event) =>
                      onChangeSet(set.key, { note: event.target.value })
                    }
                    onBlur={() => onChangeSet(set.key, { noteOpen: false })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        // Done with the note, without submitting the form.
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                    maxLength={SET_NOTE_MAX}
                    placeholder={t("setNotePlaceholder")}
                    aria-label={t("setNote", { n })}
                    autoComplete="off"
                    enterKeyHint="done"
                    wrapperClassName="min-w-0 flex-1"
                    className="min-h-8 py-1 text-sm"
                  />
                  <span aria-hidden className="text-xs text-muted tabular-nums">
                    {t("setNoteCount", {
                      count: set.note.length,
                      max: SET_NOTE_MAX,
                    })}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onChangeSet(set.key, { noteOpen: true })}
                  aria-label={
                    noteText
                      ? t("editSetNoteLabel", { n, note: noteText })
                      : t("addSetNoteLabel", { n })
                  }
                  className={cn(
                    "block min-h-8 max-w-full truncate text-left text-sm",
                    noteText ? "text-muted" : "font-medium text-accent",
                  )}
                >
                  {noteText || t("addSetNote")}
                </button>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAddSet}
        disabled={isAtLimit}
        className={cn(BUTTON_SECONDARY, "min-h-11 w-full text-sm")}
      >
        <Plus className="size-4" aria-hidden />
        {t("addSet")}
      </button>
      {isAtLimit && <p className={FIELD_ERROR}>{t("setLimit")}</p>}
    </div>
  );
};
