"use client";

import { ChevronDown, MessageCircle, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { IconButton } from "@/components/common/IconButton";
import { CARD } from "@/constants/styles";
import type { TrainingNote } from "@/features/training-notes/types/training-note";
import {
  formatSetChip,
  getSetNotes,
  type ItemFormatter,
} from "@/features/training-notes/utils/note-format";
import { cn } from "@/utils/cn";

interface NoteCardProps {
  note: TrainingNote;
  onEdit: () => void;
  onDelete: () => void;
}

export const NoteCard = ({ note, onEdit, onDelete }: NoteCardProps) => {
  const t = useTranslations("trainingNotes");
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const format: ItemFormatter = (key, values) => t(key, values);
  const title = note.title ?? t("untitled");
  const setNotes = note.items.flatMap((item) =>
    getSetNotes(item).map((entry) => ({ ...entry, name: item.exerciseName })),
  );
  const listId = `note-${note.id}-set-notes`;

  return (
    <li className={CARD}>
      <div className="flex items-start">
        <button
          type="button"
          onClick={onEdit}
          aria-label={t("edit", { title })}
          className="min-w-0 flex-1 space-y-1 p-3 text-left"
        >
          <span className="block truncate font-semibold text-fg">{title}</span>
          {note.items.length > 0 && (
            <span className="block space-y-2 text-sm text-fg">
              {note.items.map((item) => (
                <span key={item.id} className="block">
                  <span className="block font-medium text-accent">
                    {item.exerciseName}
                  </span>
                  {item.sets.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {item.sets.map((set) => {
                        const label = formatSetChip(set, format);

                        return label === null ? null : (
                          <span
                            key={set.position}
                            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg px-2.5 py-0.5 text-xs font-medium tabular-nums"
                          >
                            {label}
                            {set.note !== null && (
                              <span
                                aria-hidden
                                className="size-1.5 rounded-full bg-accent"
                              />
                            )}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </span>
              ))}
            </span>
          )}
          {note.note && (
            <span className="block text-sm whitespace-pre-line text-muted">
              {note.note}
            </span>
          )}
        </button>
        <IconButton
          label={t("delete")}
          onClick={onDelete}
          className="mt-1 mr-1"
        >
          <Trash2 className="size-5" aria-hidden />
        </IconButton>
      </div>
      {setNotes.length > 0 && (
        <div className="px-3 pb-3">
          <button
            type="button"
            aria-expanded={isNotesOpen}
            aria-controls={listId}
            onClick={() => setIsNotesOpen((open) => !open)}
            className="flex min-h-9 items-center gap-1.5 text-sm font-medium text-muted"
          >
            <MessageCircle className="size-4" aria-hidden />
            {t("notesToggle", { count: setNotes.length })}
            <ChevronDown
              className={cn("size-4 transition", isNotesOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {isNotesOpen && (
            <ul id={listId} className="mt-1 space-y-1 text-sm text-fg">
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
          )}
        </div>
      )}
    </li>
  );
};
