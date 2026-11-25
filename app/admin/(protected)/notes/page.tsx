import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { ScrollToTopButton } from "@/components/common/ScrollToTopButton";
import { TIME_ZONE } from "@/constants/time";
import { TrainingNotesView } from "@/features/training-notes/components/TrainingNotesView";
import { COMMON_EXERCISES } from "@/features/training-notes/constants/suggestions";
import {
  listExerciseNames,
  listTrainingNotes,
} from "@/features/training-notes/services/training-note-queries";
import { parseTrainingNoteRange } from "@/features/training-notes/utils/note-filters";
import {
  formatNoteDayLabel,
  groupNotesByDate,
} from "@/features/training-notes/utils/note-format";
import { requireAdmin } from "@/services/auth-guard";
import { parseLocale } from "@/utils/locale";
import { readSearchParam } from "@/utils/search-params";
import { getTodayDate } from "@/utils/week";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("trainingNotes");

  return { title: t("metaTitle") };
};

const AdminNotesPage = async ({ searchParams }: PageProps<"/admin/notes">) => {
  const admin = await requireAdmin();
  const locale = parseLocale(await getLocale());
  const params = await searchParams;
  const range = parseTrainingNoteRange(readSearchParam(params.range));
  const query = (readSearchParam(params.q) ?? "").slice(0, 100);
  const today = getTodayDate(TIME_ZONE);

  const [notes, usedNames] = await Promise.all([
    listTrainingNotes(admin.id, { q: query, range, today }),
    listExerciseNames(admin.id),
  ]);
  const suggestions = [...new Set([...usedNames, ...COMMON_EXERCISES])];

  return (
    <>
      <TrainingNotesView
        groups={groupNotesByDate(notes, (date) =>
          formatNoteDayLabel(date, locale, today.slice(0, 4)),
        )}
        range={range}
        query={query}
        hasNoNotes={notes.length === 0 && range === "all" && query === ""}
        today={today}
        suggestions={suggestions}
      />
      <ScrollToTopButton />
    </>
  );
};

export default AdminNotesPage;
