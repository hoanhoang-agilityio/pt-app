"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { IconButton } from "@/components/common/IconButton";
import { Input } from "@/components/common/Input";
import { LABEL } from "@/constants/styles";
import {
  DURATION_MAX_SEC,
  EXERCISE_NAME_MAX,
  REPS_MAX,
  SETS_MAX,
} from "@/features/training-notes/constants/limits";
import {
  type AmountUnit,
  type ItemDraft,
} from "@/features/training-notes/utils/note-draft";
import { cn } from "@/utils/cn";

export const EXERCISE_LIST_ID = "training-note-exercises";

const UNITS: AmountUnit[] = ["reps", "seconds"];

// Set, Rep | Giây and Kg share one grid: a fixed-height header row (label or
// switch) above equal-height inputs keeps the three inputs on one baseline.
const HEADER = "flex h-9 items-center";

interface NoteItemFieldsProps {
  item: ItemDraft;
  index: number;
  onChange: (changes: Partial<ItemDraft>) => void;
  onRemove: () => void;
}

export const NoteItemFields = ({
  item,
  index,
  onChange,
  onRemove,
}: NoteItemFieldsProps) => {
  const t = useTranslations("trainingNotes.form");
  const id = `note-item-${item.key}`;

  return (
    <fieldset className="space-y-1 rounded-2xl border border-line bg-surface p-3">
      <legend className="sr-only">{`${t("exercise")} ${index + 1}`}</legend>
      <div className="flex items-center justify-between">
        <label htmlFor={`${id}-name`} className={cn(LABEL, "mb-0")}>
          {t("exercise")}
        </label>
        <IconButton
          label={t("removeItem")}
          size="sm"
          onClick={onRemove}
          className="-mr-1"
        >
          <Trash2 className="size-5" aria-hidden />
        </IconButton>
      </div>
      <Input
        id={`${id}-name`}
        list={EXERCISE_LIST_ID}
        value={item.name}
        onChange={(event) => onChange({ name: event.target.value })}
        placeholder={t("exercisePlaceholder")}
        maxLength={EXERCISE_NAME_MAX}
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="next"
      />
      <div className="grid grid-cols-[1fr_1.4fr_1fr] gap-x-2">
        <label htmlFor={`${id}-sets`} className={cn(LABEL, HEADER, "mb-0")}>
          {t("sets")}
        </label>
        <div
          role="group"
          aria-label={t("unitLabel")}
          className={cn(HEADER, "gap-0.5")}
        >
          <div className="grid h-9 w-full grid-cols-2 gap-0.5 rounded-lg border border-line bg-bg p-0.5">
            {UNITS.map((unit) => (
              <button
                key={unit}
                type="button"
                aria-pressed={item.unit === unit}
                onClick={() => onChange({ unit })}
                className={cn(
                  "rounded-md text-sm font-semibold transition",
                  item.unit === unit
                    ? "bg-accent text-accent-fg"
                    : "text-muted",
                )}
              >
                {t(`units.${unit}`)}
              </button>
            ))}
          </div>
        </div>
        <label htmlFor={`${id}-weight`} className={cn(LABEL, HEADER, "mb-0")}>
          {t("weight")}
        </label>
        <Input
          id={`${id}-sets`}
          inputMode="numeric"
          value={item.sets}
          onChange={(event) => onChange({ sets: event.target.value })}
          placeholder="4"
          maxLength={String(SETS_MAX).length}
          autoComplete="off"
        />
        <Input
          aria-label={t("amount")}
          inputMode="numeric"
          value={item.amount}
          onChange={(event) => onChange({ amount: event.target.value })}
          placeholder={item.unit === "reps" ? "8" : "45"}
          maxLength={
            String(item.unit === "reps" ? REPS_MAX : DURATION_MAX_SEC).length
          }
          autoComplete="off"
        />
        <Input
          id={`${id}-weight`}
          inputMode="decimal"
          value={item.weight}
          onChange={(event) => onChange({ weight: event.target.value })}
          placeholder={t("optional")}
          autoComplete="off"
        />
      </div>
    </fieldset>
  );
};
