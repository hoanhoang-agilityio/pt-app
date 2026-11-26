"use client";

import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Dumbbell,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { IconButton } from "@/components/common/IconButton";
import type { TrainingNote } from "@/features/training-notes/types/training-note";
import {
  formatSetChip,
  getSetNotes,
  type ItemFormatter,
  summarizeNote,
} from "@/features/training-notes/utils/note-format";
import { cn } from "@/utils/cn";

interface NoteCardProps {
  note: TrainingNote;
  // `openIndex`: the exercise to expand in the form; the first when omitted.
  onEdit: (openIndex?: number) => void;
  onDelete: () => void;
}

export const NoteCard = ({ note, onEdit, onDelete }: NoteCardProps) => {
  const t = useTranslations("trainingNotes");
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const format: ItemFormatter = (key, values) => t(key, values);
  const title = note.title ?? t("untitled");
  const summary = summarizeNote(note);
  const setNotes = note.items.flatMap((item) =>
    getSetNotes(item).map((entry) => ({ ...entry, name: item.exerciseName })),
  );
  const hasBody =
    note.items.length > 0 || Boolean(note.note) || setNotes.length > 0;
  const listId = `note-${note.id}-set-notes`;
  const bodyId = `note-${note.id}-body`;

  return (
    <li className="relative overflow-hidden rounded-2xl border border-line bg-surface">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" />
      <div className="flex items-center gap-1 py-3 pr-2 pl-4">
        <button
          type="button"
          onClick={() => onEdit()}
          aria-label={t("edit", { title })}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl text-left focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface))] text-accent">
            <Dumbbell className="size-6" aria-hidden />
          </span>
          <span className="grid min-w-0 gap-1">
            <span className="text-lg leading-tight font-semibold text-fg [overflow-wrap:anywhere]">
              {title}
            </span>
            <span className="flex items-center gap-2 text-[13px] font-medium text-accent">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-accent"
              />
              {t("typeLabel")}
            </span>
            {isCollapsed && (
              <span className="text-[13px] text-muted tabular-nums">
                {t("summary", {
                  exercises: summary.exercises,
                  sets: summary.sets,
                })}
              </span>
            )}
          </span>
        </button>
        {hasBody && (
          <IconButton
            label={t(isCollapsed ? "expand" : "collapse", { title })}
            aria-expanded={!isCollapsed}
            aria-controls={bodyId}
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          >
            {isCollapsed ? (
              <ChevronDown className="size-5" aria-hidden />
            ) : (
              <ChevronUp className="size-5" aria-hidden />
            )}
          </IconButton>
        )}
        <IconButton label={t("delete")} onClick={onDelete}>
          <Trash2 className="size-5" aria-hidden />
        </IconButton>
      </div>
      <div id={bodyId} hidden={isCollapsed}>
        {note.items.length > 0 && (
          <div className="@container grid gap-2 pr-2 pb-2 pl-3">
            {note.items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onEdit(index)}
                aria-label={t("editExercise", {
                  name: item.exerciseName,
                  count: item.sets.length,
                })}
                className="flex min-h-14 w-full items-center gap-2 rounded-2xl bg-bg p-3 text-left transition hover:bg-[color-mix(in_srgb,var(--fg)_8%,var(--bg))] focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
              >
                <span className="grid min-w-0 flex-1 gap-2 @min-[420px]:grid-cols-[minmax(8.75rem,1fr)_auto] @min-[420px]:items-center @min-[420px]:gap-3">
                  <span className="min-w-0 text-sm font-semibold text-accent [overflow-wrap:anywhere]">
                    {item.exerciseName}
                  </span>
                  {item.sets.length > 0 && (
                    <span className="flex flex-wrap justify-start gap-1 @min-[420px]:justify-end">
                      {item.sets.map((set) => {
                        const label = formatSetChip(set, format);

                        return label === null ? null : (
                          <span
                            key={set.position}
                            className="inline-flex h-6 items-center rounded-full border border-line px-2 text-xs font-medium whitespace-nowrap text-fg tabular-nums"
                          >
                            {label}
                            {set.note !== null && (
                              <span
                                aria-hidden
                                className="ml-1 size-1.5 rounded-full bg-accent"
                              />
                            )}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-muted"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        )}
        {note.note && (
          <p className="px-4 pb-3 text-sm whitespace-pre-line text-muted">
            {note.note}
          </p>
        )}
        {setNotes.length > 0 && (
          <div className="border-t border-line">
            <button
              type="button"
              aria-expanded={isNotesOpen}
              aria-controls={listId}
              onClick={() => setIsNotesOpen((open) => !open)}
              className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-[13px] font-semibold text-fg transition hover:bg-bg focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none focus-visible:ring-inset"
            >
              <MessageCircle className="size-4" aria-hidden />
              {t("notesToggle", { count: setNotes.length })}
              <ChevronDown
                className={cn(
                  "ml-auto size-4 transition",
                  isNotesOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <ul
              id={listId}
              hidden={!isNotesOpen}
              className="space-y-2 px-4 pb-3 text-[13px] text-fg"
            >
              {setNotes.map((entry) => (
                <li key={`${entry.itemId}-${entry.setNumber}`}>
                  <b className="font-semibold">
                    {t("setNoteLabel", {
                      name: entry.name,
                      n: entry.setNumber,
                    })}
                  </b>{" "}
                  {entry.note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
};
