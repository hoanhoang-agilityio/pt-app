"use client";

import { Plus, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { BottomSheet } from "@/components/common/BottomSheet";
import { Input } from "@/components/common/Input";
import { SubmitButton } from "@/components/common/SubmitButton";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FIELD_ERROR,
  LABEL,
  TEXTAREA,
} from "@/constants/styles";
import {
  EXERCISE_LIST_ID,
  NoteItemFields,
} from "@/features/training-notes/components/NoteItemFields";
import {
  NOTE_TEXT_MAX,
  NOTE_TITLE_MAX,
} from "@/features/training-notes/constants/limits";
import { useNoteForm } from "@/features/training-notes/hooks/use-note-form";
import type { TrainingNote } from "@/features/training-notes/types/training-note";

interface NoteFormSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // null = a new note.
  note: TrainingNote | null;
  // "YYYY-MM-DD" in the app time zone: the default date of a new note.
  today: string;
  // Names offered in the exercise field.
  suggestions: string[];
}

export const NoteFormSheet = ({
  isOpen,
  onOpenChange,
  note,
  today,
  suggestions,
}: NoteFormSheetProps) => {
  const t = useTranslations("trainingNotes.form");
  const {
    draft,
    error,
    isPending,
    canAddItem,
    setField,
    updateItem,
    addItem,
    removeItem,
    submit,
  } = useNoteForm(note, today, () => onOpenChange(false));

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={note ? t("editTitle") : t("addTitle")}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="note-date" className={LABEL}>
            {t("date")}
          </label>
          <Input
            id="note-date"
            type="date"
            value={draft.date}
            onChange={(event) => setField("date", event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="note-title" className={LABEL}>
            {t("title")}
          </label>
          <Input
            id="note-title"
            value={draft.title}
            onChange={(event) => setField("title", event.target.value)}
            placeholder={t("titlePlaceholder")}
            maxLength={NOTE_TITLE_MAX}
            autoComplete="off"
            clearable
          />
        </div>
        <datalist id={EXERCISE_LIST_ID}>
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="space-y-2">
          {draft.items.map((item, index) => (
            <NoteItemFields
              key={item.key}
              item={item}
              index={index}
              onChange={(changes) => updateItem(item.key, changes)}
              onRemove={() => removeItem(item.key)}
            />
          ))}
          <button
            type="button"
            onClick={addItem}
            disabled={!canAddItem}
            className={`${BUTTON_SECONDARY} w-full`}
          >
            <Plus className="size-5" aria-hidden />
            {t("addItem")}
          </button>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="note-text" className={LABEL}>
              {t("note")}
            </label>
            <span className="text-xs text-muted">
              {t("noteCount", {
                count: draft.note.length,
                max: NOTE_TEXT_MAX,
              })}
            </span>
          </div>
          <textarea
            id="note-text"
            value={draft.note}
            onChange={(event) => setField("note", event.target.value)}
            placeholder={t("notePlaceholder")}
            maxLength={NOTE_TEXT_MAX}
            className={TEXTAREA}
          />
        </div>
        {error && (
          <p role="alert" className={FIELD_ERROR}>
            {error}
          </p>
        )}
        {/* Pinned to the sheet's bottom edge so it stays reachable while the
            keyboard is up; the negative margin cancels the sheet's padding. */}
        <div className="sticky bottom-0 -mb-[calc(env(safe-area-inset-bottom)+1.25rem)] bg-bg pt-2 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
          <SubmitButton
            isPending={isPending}
            className={`${BUTTON_PRIMARY} w-full`}
          >
            <Save className="size-5" aria-hidden />
            {t("submit")}
          </SubmitButton>
        </div>
      </form>
    </BottomSheet>
  );
};
