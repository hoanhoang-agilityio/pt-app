"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { NOTE_MAX_ITEMS } from "@/features/training-notes/constants/limits";
import { saveTrainingNoteAction } from "@/features/training-notes/services/training-note-actions";
import type { TrainingNote } from "@/features/training-notes/types/training-note";
import {
  createEmptyItem,
  type ItemDraft,
  type NoteDraft,
  toDraft,
  toInput,
} from "@/features/training-notes/utils/note-draft";

export const useNoteForm = (
  note: TrainingNote | null,
  today: string,
  onDone: () => void,
) => {
  const t = useTranslations("trainingNotes.form");
  const [draft, setDraft] = useState<NoteDraft>(() => toDraft(note, today));
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const nextKey = useRef(draft.items.length);

  const setField = (field: "date" | "title" | "note", value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const updateItem = (key: number, changes: Partial<ItemDraft>) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key ? { ...item, ...changes } : item,
      ),
    }));

  const addItem = () =>
    setDraft((current) =>
      current.items.length >= NOTE_MAX_ITEMS
        ? current
        : {
            ...current,
            items: [...current.items, createEmptyItem(nextKey.current++)],
          },
    );

  const removeItem = (key: number) =>
    setDraft((current) => {
      const items = current.items.filter((item) => item.key !== key);

      // The form always keeps one row to type into.
      return {
        ...current,
        items: items.length > 0 ? items : [createEmptyItem(nextKey.current++)],
      };
    });

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveTrainingNoteAction(toInput(draft, note?.id));

      if (result.status !== "success") {
        setError(result.message);
        return;
      }
      toast.success(t("saved"));
      onDone();
    });
  };

  return {
    draft,
    error,
    isPending,
    canAddItem: draft.items.length < NOTE_MAX_ITEMS,
    setField,
    updateItem,
    addItem,
    removeItem,
    submit,
  };
};
