import type {
  SetUnit,
  TrainingNote,
  TrainingNoteItem,
  TrainingNoteSet,
} from "@/features/training-notes/types/training-note";
import type { TrainingNoteInput } from "@/features/training-notes/utils/note-schema";

// A set row as typed: every number is text until it is submitted.
export interface SetDraft {
  key: number;
  kg: string;
  value: string;
  unit: SetUnit;
  note: string;
  // The note input is showing (otherwise "+ Ghi chú" or the note text).
  noteOpen: boolean;
}

// An exercise as typed; `open` is whether its card is expanded.
export interface ItemDraft {
  key: number;
  name: string;
  // Library exercise picked for this row ("b:<id>" / "c:<id>"), else null.
  ref: string | null;
  open: boolean;
  sets: SetDraft[];
}

export interface NoteDraft {
  date: string;
  title: string;
  note: string;
  items: ItemDraft[];
}

export const createEmptySet = (key: number): SetDraft => ({
  key,
  kg: "",
  value: "",
  unit: "reps",
  note: "",
  noteOpen: false,
});

// A new set starts as a copy of the previous one (kg, value, unit): sets of
// one exercise usually repeat.
export const createSetFrom = (previous: SetDraft, key: number): SetDraft => ({
  ...createEmptySet(key),
  kg: previous.kg,
  value: previous.value,
  unit: previous.unit,
});

export const createEmptyItem = (key: number, setKey: number): ItemDraft => ({
  key,
  name: "",
  ref: null,
  open: true,
  sets: [createEmptySet(setKey)],
});

// Item and set keys come from one counter, so they never collide.
export const getNextKey = (draft: NoteDraft) =>
  Math.max(
    -1,
    ...draft.items.flatMap((item) => [
      item.key,
      ...item.sets.map((s) => s.key),
    ]),
  ) + 1;

const toDraftSet = (set: TrainingNoteSet, key: number): SetDraft => ({
  key,
  kg: set.weightKg === null ? "" : String(set.weightKg).replace(".", ","),
  value: String(set.durationSec ?? set.reps ?? ""),
  unit: set.unit,
  note: set.note ?? "",
  noteOpen: false,
});

// Keys are handed out in order from `next.key`.
const toDraftItem = (
  item: TrainingNoteItem,
  open: boolean,
  next: { key: number },
): ItemDraft => {
  const key = next.key++;
  const sets = item.sets.map((set) => toDraftSet(set, next.key++));

  return {
    key,
    name: item.exerciseName,
    ref: item.exerciseRef,
    open,
    sets: sets.length > 0 ? sets : [createEmptySet(next.key++)],
  };
};

// The form of an existing note (only the exercise at `openIndex` expanded,
// the first by default), or an empty one for `today`.
export const toDraft = (
  note: TrainingNote | null,
  today: string,
  openIndex = 0,
): NoteDraft => {
  if (!note) {
    return {
      date: today,
      title: "",
      note: "",
      items: [createEmptyItem(0, 1)],
    };
  }
  const next = { key: 0 };
  const openAt =
    Number.isInteger(openIndex) &&
    openIndex >= 0 &&
    openIndex < note.items.length
      ? openIndex
      : 0;
  const items = note.items.map((item, index) =>
    toDraftItem(item, index === openAt, next),
  );

  return {
    date: note.date,
    title: note.title ?? "",
    note: note.note ?? "",
    items: items.length > 0 ? items : [createEmptyItem(next.key++, next.key++)],
  };
};

// Blank text is an empty value; anything else is converted as typed, so a
// wrong value (NaN, 1.5 reps) reaches the server's validation and is reported.
const toNumber = (text: string) => {
  const trimmed = text.trim().replace(",", ".");

  return trimmed === "" ? null : Number(trimmed);
};

export const toInput = (draft: NoteDraft, id?: number): TrainingNoteInput => ({
  id,
  date: draft.date,
  title: draft.title,
  note: draft.note,
  items: draft.items.map((item) => ({
    exerciseName: item.name,
    exerciseRef: item.ref,
    sets: item.sets.map((set) => {
      const value = toNumber(set.value);

      return {
        unit: set.unit,
        reps: set.unit === "reps" ? value : null,
        durationSec: set.unit === "seconds" ? value : null,
        weightKg: toNumber(set.kg),
        note: set.note,
      };
    }),
  })),
});

interface Range {
  min: number;
  max: number;
}

// What a collapsed exercise shows: "3 set · 60–90 kg", "3 set · 45 giây".
export interface ItemSummary {
  sets: number;
  kg: Range | null;
  // Reps, seconds, or both mixed (no range then).
  value: ({ kind: "reps" | "seconds" } & Range) | { kind: "mixed" } | null;
}

const toRange = (numbers: number[]): Range | null =>
  numbers.length === 0
    ? null
    : { min: Math.min(...numbers), max: Math.max(...numbers) };

const isNumber = (value: number | null): value is number =>
  value !== null && !Number.isNaN(value);

// Same rule as the schema's blank check: no value, no kg, no note.
const isBlankDraftSet = (set: SetDraft) =>
  set.value.trim() === "" && set.kg.trim() === "" && set.note.trim() === "";

export const summarizeItem = (item: ItemDraft): ItemSummary => {
  const filled = item.sets.filter((set) => !isBlankDraftSet(set));
  const kg = filled.map((set) => toNumber(set.kg)).filter(isNumber);
  const valuesOf = (unit: SetUnit) =>
    filled
      .filter((set) => set.unit === unit)
      .map((set) => toNumber(set.value))
      .filter(isNumber);
  const reps = toRange(valuesOf("reps"));
  const seconds = toRange(valuesOf("seconds"));
  let value: ItemSummary["value"] = null;

  if (reps && seconds) {
    value = { kind: "mixed" };
  } else if (reps) {
    value = { kind: "reps", ...reps };
  } else if (seconds) {
    value = { kind: "seconds", ...seconds };
  }
  return { sets: filled.length, kg: toRange(kg), value };
};

// Moves the item with `fromKey` to `toIndex` (clamped to the list). An unknown
// key or a move to the same place returns `items` itself, so state setters
// can skip a re-render.
export const moveItem = (
  items: ItemDraft[],
  fromKey: number,
  toIndex: number,
): ItemDraft[] => {
  const from = items.findIndex((item) => item.key === fromKey);

  if (from === -1 || !Number.isFinite(toIndex)) {
    return items;
  }
  const to = Math.min(Math.max(Math.trunc(toIndex), 0), items.length - 1);

  if (to === from) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);

  next.splice(to, 0, moved);
  return next;
};
