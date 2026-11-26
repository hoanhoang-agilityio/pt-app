"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  NOTE_MAX_ITEMS,
  SETS_PER_ITEM_MAX,
} from "@/features/training-notes/constants/limits";
import { saveTrainingNoteAction } from "@/features/training-notes/services/training-note-actions";
import type { TrainingNote } from "@/features/training-notes/types/training-note";
import {
  createEmptyItem,
  createSetFrom,
  getNextKey,
  type ItemDraft,
  type NoteDraft,
  type SetDraft,
  toDraft,
  toInput,
} from "@/features/training-notes/utils/note-draft";
import { trainingNoteSchema } from "@/features/training-notes/utils/note-schema";

export const useNoteForm = (
  note: TrainingNote | null,
  today: string,
  onDone: () => void,
  // Which exercise of an existing note starts expanded.
  openIndex = 0,
) => {
  const t = useTranslations("trainingNotes.form");
  const [draft, setDraft] = useState<NoteDraft>(() =>
    toDraft(note, today, openIndex),
  );
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  // One counter for item and set keys.
  const nextKey = useRef(getNextKey(draft));

  const newItem = () => createEmptyItem(nextKey.current++, nextKey.current++);

  const setField = (field: "date" | "title" | "note", value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const updateItem = (key: number, changes: Partial<ItemDraft>) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key ? { ...item, ...changes } : item,
      ),
    }));

  const updateItemSets = (
    itemKey: number,
    change: (sets: SetDraft[]) => SetDraft[],
  ) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === itemKey ? { ...item, sets: change(item.sets) } : item,
      ),
    }));

  const updateSet = (
    itemKey: number,
    setKey: number,
    changes: Partial<SetDraft>,
  ) =>
    updateItemSets(itemKey, (sets) =>
      sets.map((set) => (set.key === setKey ? { ...set, ...changes } : set)),
    );

  // A new set copies the previous one; the limit is enforced here too.
  const addSet = (itemKey: number) =>
    updateItemSets(itemKey, (sets) => {
      const previous = sets.at(-1);

      return sets.length >= SETS_PER_ITEM_MAX || !previous
        ? sets
        : [...sets, createSetFrom(previous, nextKey.current++)];
    });

  // An exercise always keeps one set row to type into.
  const removeSet = (itemKey: number, setKey: number) =>
    updateItemSets(itemKey, (sets) =>
      sets.length < 2 ? sets : sets.filter((set) => set.key !== setKey),
    );

  const addItem = () =>
    setDraft((current) =>
      current.items.length >= NOTE_MAX_ITEMS
        ? current
        : { ...current, items: [...current.items, newItem()] },
    );

  const removeItem = (key: number) =>
    setDraft((current) => {
      const items = current.items.filter((item) => item.key !== key);

      // The form always keeps one row to type into.
      return { ...current, items: items.length > 0 ? items : [newItem()] };
    });

  // Expands the exercise a validation error points at, so the field to fix is
  // not hidden in a collapsed card.
  const openFailedItem = () => {
    const result = trainingNoteSchema.safeParse(toInput(draft));
    const path = result.success ? undefined : result.error.issues[0]?.path;
    const index = path?.[0] === "items" ? Number(path[1]) : null;

    if (index === null) {
      return;
    }
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, position) =>
        position === index ? { ...item, open: true } : item,
      ),
    }));
  };

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await saveTrainingNoteAction(toInput(draft, note?.id));

      if (result.status !== "success") {
        setError(result.message);
        openFailedItem();
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
    updateSet,
    addSet,
    removeSet,
    addItem,
    removeItem,
    submit,
  };
};
