import type {
  TrainingNote,
  TrainingNoteGroup,
  TrainingNoteItem,
} from "@/features/training-notes/types/training-note";
import type { Locale } from "@/utils/locale";
import { formatDayMonth, formatFullDay, getWeekdayLabel } from "@/utils/week";

type ItemFormatKey =
  | "item.setsReps"
  | "item.setsSeconds"
  | "item.repsOnly"
  | "item.secondsOnly"
  | "item.setsOnly"
  | "item.weight";

export type ItemFormatter = (
  key: ItemFormatKey,
  values: Record<string, number>,
) => string;

// "Squat · 4 × 8 · 80 kg" / "Plank · 3 × 45 giây": the name, then sets and
// reps (or seconds), then the weight when there is one.
export const formatItemLine = (
  item: TrainingNoteItem,
  format: ItemFormatter,
) => {
  const { sets, reps, durationSec, weightKg } = item;
  const parts = [item.exerciseName];

  if (durationSec !== null) {
    parts.push(
      sets === null
        ? format("item.secondsOnly", { seconds: durationSec })
        : format("item.setsSeconds", { sets, seconds: durationSec }),
    );
  } else if (reps !== null) {
    parts.push(
      sets === null
        ? format("item.repsOnly", { reps })
        : format("item.setsReps", { sets, reps }),
    );
  } else if (sets !== null) {
    parts.push(format("item.setsOnly", { sets }));
  }
  if (weightKg !== null) {
    parts.push(format("item.weight", { kg: weightKg }));
  }
  return parts.join(" · ");
};

// Keeps the incoming order (newest day first) and groups by day.
export const groupNotesByDate = (
  notes: TrainingNote[],
  getLabel: (date: string) => string,
): TrainingNoteGroup[] => {
  const groups: TrainingNoteGroup[] = [];

  for (const note of notes) {
    const last = groups.at(-1);

    if (last?.date === note.date) {
      last.notes.push(note);
    } else {
      groups.push({
        date: note.date,
        label: getLabel(note.date),
        notes: [note],
      });
    }
  }
  return groups;
};

// "Thứ Tư, 25/11" for this year; other years carry the year too: "Thứ Tư,
// 25/11/2024", "Wednesday, Nov 25, 2024", "周三，2024年11月25日".
export const formatNoteDayLabel = (
  date: string,
  locale: Locale,
  currentYear: string,
) => {
  const year = date.slice(0, 4);

  if (year === currentYear) {
    return formatFullDay(date, locale);
  }
  const weekday = getWeekdayLabel(date, locale);
  const dayMonth = formatDayMonth(date, locale);

  if (locale === "zh") {
    return `${weekday}，${year}年${dayMonth}`;
  }
  return locale === "vi"
    ? `${weekday}, ${dayMonth}/${year}`
    : `${weekday}, ${dayMonth}, ${year}`;
};
