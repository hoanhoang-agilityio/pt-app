import type {
  TrainingNote,
  TrainingNoteGroup,
  TrainingNoteItem,
  TrainingNoteSet,
} from "@/features/training-notes/types/training-note";
import type { Locale } from "@/utils/locale";
import { formatDayMonth, formatFullDay, getWeekdayLabel } from "@/utils/week";

type ItemFormatKey =
  | "item.repsOnly"
  | "item.secondsOnly"
  | "item.chipKgReps"
  | "item.chipKgSeconds"
  | "item.chipKgOnly"
  | "item.chipSet";

export type ItemFormatter = (
  key: ItemFormatKey,
  values: Record<string, number>,
) => string;

const getValue = (set: TrainingNoteSet) =>
  set.unit === "reps" ? set.reps : set.durationSec;

// One chip per set on the card: "60 kg × 10", "24 kg × 40 giây", "10 rep",
// "45 giây", "20 kg" (weight only). A set with only a note (or a legacy count-
// only row) gets the neutral "Set n" label so it still shows.
export const formatSetChip = (set: TrainingNoteSet, format: ItemFormatter) => {
  const value = getValue(set);

  if (value === null) {
    return set.weightKg === null
      ? format("item.chipSet", { n: set.position + 1 })
      : format("item.chipKgOnly", { kg: set.weightKg });
  }
  if (set.unit === "seconds") {
    return set.weightKg === null
      ? format("item.secondsOnly", { seconds: value })
      : format("item.chipKgSeconds", { kg: set.weightKg, seconds: value });
  }
  return set.weightKg === null
    ? format("item.repsOnly", { reps: value })
    : format("item.chipKgReps", { kg: set.weightKg, reps: value });
};

export interface SetNote {
  itemId: number;
  // 1-based, as shown to the admin ("set 3").
  setNumber: number;
  note: string;
}

// The notes of an exercise's sets, in set order.
export const getSetNotes = (item: TrainingNoteItem): SetNote[] =>
  item.sets.flatMap((set, index) =>
    set.note === null
      ? []
      : [{ itemId: item.id, setNumber: index + 1, note: set.note }],
  );

export interface NoteSummary {
  exercises: number;
  sets: number;
}

// The counts behind the collapsed card ("7 bài · 21 set"): exercises, and every
// set, since each one renders a chip (a set without values shows "Set n").
export const summarizeNote = (note: TrainingNote): NoteSummary => ({
  exercises: note.items.length,
  sets: note.items.reduce((total, item) => total + item.sets.length, 0),
});

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
