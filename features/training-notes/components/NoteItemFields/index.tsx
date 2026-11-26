"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { IconButton } from "@/components/common/IconButton";
import { Input } from "@/components/common/Input";
import { SetRows } from "@/features/training-notes/components/SetRows";
import { EXERCISE_NAME_MAX } from "@/features/training-notes/constants/limits";
import {
  type ItemDraft,
  type ItemSummary,
  type SetDraft,
  summarizeItem,
} from "@/features/training-notes/utils/note-draft";
import { cn } from "@/utils/cn";

export const EXERCISE_LIST_ID = "training-note-exercises";

interface NoteItemFieldsProps {
  item: ItemDraft;
  index: number;
  onChange: (changes: Partial<ItemDraft>) => void;
  onChangeSet: (setKey: number, changes: Partial<SetDraft>) => void;
  onAddSet: () => void;
  onRemoveSet: (setKey: number) => void;
  onRemove: () => void;
  // Reordering controls show only with more than one exercise.
  isSortable: boolean;
  isLast: boolean;
  // Some exercise is being dragged: every card shows as its collapsed row
  // without touching `item.open`.
  isCollapsed: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const moveButtonId = (itemKey: number, direction: "up" | "down") =>
  `note-item-${itemKey}-${direction}`;

type Translate = ReturnType<typeof useTranslations<"trainingNotes.form">>;

// "3 set · 60–90 kg" / "3 set · 45 giây": the weight when there is one,
// else the reps or seconds.
const formatSummary = (summary: ItemSummary, t: Translate) => {
  const parts = [t("summarySets", { count: summary.sets })];
  const { kg, value } = summary;

  if (kg) {
    parts.push(
      kg.min === kg.max
        ? t("summaryKg", { kg: kg.min })
        : t("summaryKgRange", { min: kg.min, max: kg.max }),
    );
  } else if (value?.kind === "mixed") {
    parts.push(t("summaryMixed"));
  } else if (value) {
    const same = value.min === value.max;
    const key = `summary${value.kind === "reps" ? "Reps" : "Seconds"}` as const;

    parts.push(
      same
        ? t(key, { value: value.min })
        : t(`${key}Range`, { min: value.min, max: value.max }),
    );
  }
  return parts.join(" · ");
};

export const NoteItemFields = ({
  item,
  index,
  onChange,
  onChangeSet,
  onAddSet,
  onRemoveSet,
  onRemove,
  isSortable,
  isLast,
  isCollapsed,
  onMoveUp,
  onMoveDown,
}: NoteItemFieldsProps) => {
  const t = useTranslations("trainingNotes.form");
  const id = `note-item-${item.key}`;
  const bodyId = `${id}-body`;
  const name = item.name.trim() || t("exerciseFallback", { n: index + 1 });
  const isOpen = item.open && !isCollapsed;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={t("toggleItem", { n: index + 1 })}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative rounded-2xl border border-line bg-surface p-3",
        isDragging && "z-10 border-accent shadow-lg ring-2 ring-accent/40",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        {isSortable && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-roledescription={t("sortableRole")}
            aria-label={t("dragHandle", { n: index + 1 })}
            className="-ml-2 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted active:cursor-grabbing active:bg-line"
          >
            <GripVertical className="size-5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => onChange({ open: !item.open })}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted transition",
              !isOpen && "-rotate-90",
            )}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-fg">{name}</span>
            {!isOpen && (
              <span className="block truncate text-sm text-muted tabular-nums">
                {formatSummary(summarizeItem(item), t)}
              </span>
            )}
          </span>
        </button>
        {isSortable && (
          <>
            <IconButton
              id={moveButtonId(item.key, "up")}
              label={t("moveUp", { n: index + 1 })}
              size="sm"
              onClick={onMoveUp}
              disabled={index === 0}
            >
              <ArrowUp className="size-5" aria-hidden />
            </IconButton>
            <IconButton
              id={moveButtonId(item.key, "down")}
              label={t("moveDown", { n: index + 1 })}
              size="sm"
              onClick={onMoveDown}
              disabled={isLast}
            >
              <ArrowDown className="size-5" aria-hidden />
            </IconButton>
          </>
        )}
        <IconButton
          label={t("removeItem")}
          size="sm"
          onClick={onRemove}
          className="-mr-1"
        >
          <Trash2 className="size-5" aria-hidden />
        </IconButton>
      </div>
      <div id={bodyId} hidden={!isOpen} className="mt-2 space-y-3">
        <Input
          id={`${id}-name`}
          list={EXERCISE_LIST_ID}
          value={item.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={t("exercisePlaceholder")}
          aria-label={t("exercise")}
          maxLength={EXERCISE_NAME_MAX}
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="next"
        />
        <SetRows
          idPrefix={id}
          sets={item.sets}
          onChangeSet={onChangeSet}
          onAddSet={onAddSet}
          onRemoveSet={onRemoveSet}
        />
      </div>
    </div>
  );
};
