"use client";

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { BottomSheet } from "@/components/common/BottomSheet";
import { Input } from "@/components/common/Input";
import { SubmitButton } from "@/components/common/SubmitButton";
import {
  BUTTON_PRIMARY,
  FIELD_ERROR,
  LABEL,
  TEXTAREA,
} from "@/constants/styles";
import { ExercisePickerSheet } from "@/features/exercise-library/components/ExercisePickerSheet";
import {
  moveButtonId,
  NoteItemFields,
  NoteItemOverlay,
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
  // Names this admin used before, shown first in the exercise picker.
  recentNames: string[];
  // Exercise of `note` to start expanded; the first by default.
  openIndex?: number;
}

export const NoteFormSheet = ({
  isOpen,
  onOpenChange,
  note,
  today,
  recentNames,
  openIndex,
}: NoteFormSheetProps) => {
  const t = useTranslations("trainingNotes.form");
  const {
    draft,
    error,
    isPending,
    canAddItem,
    setField,
    updateItem,
    updateSet,
    addSet,
    removeSet,
    addItem,
    removeItem,
    moveItem,
    moveItemBy,
    submit,
  } = useNoteForm(note, today, () => onOpenChange(false), openIndex);
  const dndId = useId();
  // The exercise row whose picker is open.
  const [pickerKey, setPickerKey] = useState<number | null>(null);
  // The exercise being dragged: every card shows collapsed meanwhile.
  const [draggingKey, setDraggingKey] = useState<number | null>(null);
  // The arrow to focus once the list has re-rendered in its new order.
  const pendingFocus = useRef<{ key: number; direction: "up" | "down" }>(null);
  const keys = draft.items.map((item) => item.key);
  const draggingItem = draft.items.find((item) => item.key === draggingKey);
  const isSortable = draft.items.length > 1;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // The moved arrow keeps focus; at either end it is disabled, so focus its
  // twin instead.
  useEffect(() => {
    const target = pendingFocus.current;

    pendingFocus.current = null;
    if (!target) {
      return;
    }
    const other = target.direction === "up" ? "down" : "up";
    const directions: ("up" | "down")[] = [target.direction, other];
    const button = directions
      .map((direction) =>
        document.getElementById(moveButtonId(target.key, direction)),
      )
      .find(
        (element): element is HTMLButtonElement =>
          element instanceof HTMLButtonElement && !element.disabled,
      );

    button?.focus();
  }, [draft.items]);

  const move = (key: number, direction: "up" | "down") => {
    const isMoved = moveItemBy(key, direction === "up" ? -1 : 1);

    pendingFocus.current = isMoved ? { key, direction } : null;
  };

  const describe = (id: string | number) => {
    const index = draft.items.findIndex((item) => item.key === id);
    const item = draft.items[index];

    return {
      name: item?.name.trim() || t("exerciseFallback", { n: index + 1 }),
      n: index + 1,
      total: draft.items.length,
    };
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t("dragStart", describe(active.id)),
    onDragOver: ({ active, over }) => {
      const to = over ? keys.indexOf(Number(over.id)) : -1;

      return to === -1
        ? undefined
        : t("dragOver", { ...describe(active.id), n: to + 1 });
    },
    onDragEnd: ({ active, over }) => {
      const to = over ? keys.indexOf(Number(over.id)) : -1;

      return t("dragEnd", {
        ...describe(active.id),
        ...(to === -1 ? {} : { n: to + 1 }),
      });
    },
    onDragCancel: ({ active }) => t("dragCancel", describe(active.id)),
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const focused = document.activeElement;

    // A set field with focus would keep the keyboard up while dragging.
    if (
      focused instanceof HTMLInputElement ||
      focused instanceof HTMLTextAreaElement
    ) {
      focused.blur();
    }
    setDraggingKey(Number(active.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const to = over ? keys.indexOf(Number(over.id)) : -1;

    setDraggingKey(null);
    if (to !== -1 && over?.id !== active.id) {
      moveItem(Number(active.id), to, false);
    }
  };

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
        <div className="space-y-2">
          <DndContext
            id={dndId}
            sensors={sensors}
            // Cards collapse right after the drag starts: measure again.
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: t("dragInstructions") },
            }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggingKey(null)}
          >
            <SortableContext
              items={keys}
              strategy={verticalListSortingStrategy}
            >
              {draft.items.map((item, index) => (
                <NoteItemFields
                  key={item.key}
                  item={item}
                  index={index}
                  onChange={(changes) => updateItem(item.key, changes)}
                  onChangeSet={(setKey, changes) =>
                    updateSet(item.key, setKey, changes)
                  }
                  onAddSet={() => addSet(item.key)}
                  onRemoveSet={(setKey) => removeSet(item.key, setKey)}
                  onRemove={() => removeItem(item.key)}
                  onOpenPicker={() => setPickerKey(item.key)}
                  isSortable={isSortable}
                  isLast={index === draft.items.length - 1}
                  isCollapsed={draggingKey !== null}
                  onMoveUp={() => move(item.key, "up")}
                  onMoveDown={() => move(item.key, "down")}
                />
              ))}
            </SortableContext>
            {/* Portaled out of the sheet: its transform would break the
                overlay's fixed positioning. Height follows the collapsed row,
                not the card's size before it collapsed. */}
            {draggingItem &&
              createPortal(
                <DragOverlay style={{ height: "auto" }}>
                  <NoteItemOverlay
                    item={draggingItem}
                    index={draft.items.indexOf(draggingItem)}
                  />
                </DragOverlay>,
                document.body,
              )}
          </DndContext>
          <button
            type="button"
            onClick={addItem}
            disabled={!canAddItem}
            className={`${BUTTON_PRIMARY} w-full`}
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
      <ExercisePickerSheet
        isOpen={pickerKey !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPickerKey(null);
          }
        }}
        recentNames={recentNames}
        onPick={({ name, ref, muscles }) => {
          if (pickerKey !== null) {
            updateItem(pickerKey, { name, ref, muscles });
          }
        }}
      />
    </BottomSheet>
  );
};
