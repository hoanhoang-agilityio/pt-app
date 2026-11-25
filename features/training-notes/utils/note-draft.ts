import type {
  TrainingNote,
  TrainingNoteItem,
} from "@/features/training-notes/types/training-note";
import type { TrainingNoteInput } from "@/features/training-notes/utils/note-schema";

export type AmountUnit = "reps" | "seconds";

// An exercise row as typed: every number is text until it is submitted.
export interface ItemDraft {
  key: number;
  name: string;
  sets: string;
  unit: AmountUnit;
  amount: string;
  weight: string;
}

export interface NoteDraft {
  date: string;
  title: string;
  note: string;
  items: ItemDraft[];
}

export const createEmptyItem = (key: number): ItemDraft => ({
  key,
  name: "",
  sets: "",
  unit: "reps",
  amount: "",
  weight: "",
});

const toDraftItem = (item: TrainingNoteItem, key: number): ItemDraft => ({
  key,
  name: item.exerciseName,
  sets: item.sets === null ? "" : String(item.sets),
  unit: item.durationSec === null ? "reps" : "seconds",
  amount: String(item.durationSec ?? item.reps ?? ""),
  weight: item.weightKg === null ? "" : String(item.weightKg),
});

// The form of an existing note, or an empty one for `today`.
export const toDraft = (note: TrainingNote | null, today: string): NoteDraft =>
  note
    ? {
        date: note.date,
        title: note.title ?? "",
        note: note.note ?? "",
        items:
          note.items.length > 0
            ? note.items.map((item, index) => toDraftItem(item, index))
            : [createEmptyItem(0)],
      }
    : { date: today, title: "", note: "", items: [createEmptyItem(0)] };

// Blank text is an empty value; anything else is converted as typed, so a
// wrong value (NaN, 1.5 sets) reaches the server's validation and is reported.
const toNumber = (text: string) => {
  const trimmed = text.trim().replace(",", ".");

  return trimmed === "" ? null : Number(trimmed);
};

export const toInput = (draft: NoteDraft, id?: number): TrainingNoteInput => ({
  id,
  date: draft.date,
  title: draft.title,
  note: draft.note,
  items: draft.items.map((item) => {
    const amount = toNumber(item.amount);

    return {
      exerciseName: item.name,
      sets: toNumber(item.sets),
      reps: item.unit === "reps" ? amount : null,
      durationSec: item.unit === "seconds" ? amount : null,
      weightKg: toNumber(item.weight),
    };
  }),
});
