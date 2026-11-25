"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { IconButton } from "@/components/common/IconButton";
import { CARD } from "@/constants/styles";
import type { TrainingNote } from "@/features/training-notes/types/training-note";
import {
  formatItemLine,
  type ItemFormatter,
} from "@/features/training-notes/utils/note-format";

interface NoteCardProps {
  note: TrainingNote;
  onEdit: () => void;
  onDelete: () => void;
}

export const NoteCard = ({ note, onEdit, onDelete }: NoteCardProps) => {
  const t = useTranslations("trainingNotes");
  const format: ItemFormatter = (key, values) => t(key, values);
  const title = note.title ?? t("untitled");

  return (
    <li className={`${CARD} flex items-start`}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("edit", { title })}
        className="min-w-0 flex-1 space-y-1 p-3 text-left"
      >
        <span className="block truncate font-semibold text-fg">{title}</span>
        {note.items.length > 0 && (
          <span className="block space-y-0.5 text-sm text-fg">
            {note.items.map((item) => (
              <span key={item.id} className="block">
                {formatItemLine(item, format)}
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
      <IconButton label={t("delete")} onClick={onDelete} className="mt-1 mr-1">
        <Trash2 className="size-5" aria-hidden />
      </IconButton>
    </li>
  );
};
