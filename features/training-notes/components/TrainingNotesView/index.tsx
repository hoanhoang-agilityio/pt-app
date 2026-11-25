"use client";

import { Lock, NotebookPen, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/common/ConfirmDialog/use-confirm";
import { Input } from "@/components/common/Input";
import { AppHeader } from "@/components/layout/AppHeader";
import { ROUTES } from "@/constants/routes";
import {
  BUTTON_PRIMARY,
  CARD,
  PAGE_CONTAINER,
  SECTION_TITLE,
} from "@/constants/styles";
import { NoteCard } from "@/features/training-notes/components/NoteCard";
import { NoteFormSheet } from "@/features/training-notes/components/NoteFormSheet";
import {
  buildNotesHref,
  useNoteFilters,
} from "@/features/training-notes/hooks/use-note-filters";
import { deleteTrainingNoteAction } from "@/features/training-notes/services/training-note-actions";
import type {
  TrainingNote,
  TrainingNoteGroup,
  TrainingNoteRange,
} from "@/features/training-notes/types/training-note";
import { TRAINING_NOTE_RANGES } from "@/features/training-notes/utils/note-filters";
import { cn } from "@/utils/cn";

interface SheetState {
  isOpen: boolean;
  note: TrainingNote | null;
  // Remounts the sheet so each opening starts from its own draft.
  nonce: number;
}

interface TrainingNotesViewProps {
  groups: TrainingNoteGroup[];
  range: TrainingNoteRange;
  query: string;
  // True when the admin has no notes at all (not just none matching).
  hasNoNotes: boolean;
  today: string;
  suggestions: string[];
}

export const TrainingNotesView = ({
  groups,
  range,
  query: initialQuery,
  hasNoNotes,
  today,
  suggestions,
}: TrainingNotesViewProps) => {
  const t = useTranslations("trainingNotes");
  const confirm = useConfirm();
  const { query, setQuery } = useNoteFilters(range, initialQuery);
  const [sheet, setSheet] = useState<SheetState>({
    isOpen: false,
    note: null,
    nonce: 0,
  });

  const openSheet = (note: TrainingNote | null) =>
    setSheet((current) => ({ isOpen: true, note, nonce: current.nonce + 1 }));

  const handleDelete = async (note: TrainingNote) => {
    const isConfirmed = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmLabel: t("deleteConfirm"),
      isDanger: true,
    });

    if (!isConfirmed) {
      return;
    }
    const result = await deleteTrainingNoteAction(note.id);

    if (result.status === "success") {
      toast.success(t("deleted"));
    } else {
      toast.error(result.message);
    }
  };

  return (
    <>
      <AppHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        backHref={ROUTES.ADMIN}
        actions={
          <button
            type="button"
            onClick={() => openSheet(null)}
            className={`${BUTTON_PRIMARY} min-h-10 px-4 text-sm`}
          >
            <Plus className="size-5" aria-hidden />
            {t("add")}
          </button>
        }
      />
      <main
        className={`${PAGE_CONTAINER} space-y-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]`}
      >
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Lock className="size-4" aria-hidden />
          {t("private")}
        </p>
        {hasNoNotes ? (
          <div className={`${CARD} space-y-3 p-6 text-center`}>
            <NotebookPen className="mx-auto size-8 text-accent" aria-hidden />
            <p className="font-semibold text-fg">{t("empty.title")}</p>
            <p className="text-sm text-muted">{t("empty.hint")}</p>
            <button
              type="button"
              onClick={() => openSheet(null)}
              className={`${BUTTON_PRIMARY} w-full`}
            >
              <Plus className="size-5" aria-hidden />
              {t("empty.action")}
            </button>
          </div>
        ) : (
          <>
            <Input
              type="search"
              inputMode="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              autoComplete="off"
              leadingIcon={<Search className="size-5" aria-hidden />}
              clearable
            />
            <nav aria-label={t("rangeLabel")} className="flex flex-wrap gap-2">
              {TRAINING_NOTE_RANGES.map((value) => (
                <Link
                  key={value}
                  href={buildNotesHref(value, query)}
                  replace
                  scroll={false}
                  aria-current={range === value ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold transition",
                    range === value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line bg-surface text-fg",
                  )}
                >
                  {t(`ranges.${value}`)}
                </Link>
              ))}
            </nav>
            {groups.length === 0 ? (
              <p className={`${CARD} p-4 text-center text-sm text-muted`}>
                {t("noResult")}
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.date} className="space-y-2">
                  <h2 className={SECTION_TITLE}>{group.label}</h2>
                  <ul className="space-y-2">
                    {group.notes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onEdit={() => openSheet(note)}
                        onDelete={() => handleDelete(note)}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </main>
      <NoteFormSheet
        key={sheet.nonce}
        isOpen={sheet.isOpen}
        onOpenChange={(isOpen) =>
          setSheet((current) => ({ ...current, isOpen }))
        }
        note={sheet.note}
        today={today}
        suggestions={suggestions}
      />
    </>
  );
};
