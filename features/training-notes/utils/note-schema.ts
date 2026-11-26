import { z } from "zod";

import {
  DURATION_MAX_SEC,
  DURATION_MIN_SEC,
  EXERCISE_NAME_MAX,
  NOTE_MAX_ITEMS,
  NOTE_TEXT_MAX,
  NOTE_TITLE_MAX,
  REPS_MAX,
  REPS_MIN,
  SET_NOTE_MAX,
  SETS_PER_ITEM_MAX,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from "@/features/training-notes/constants/limits";
import { TRAINING_NOTE_MESSAGES as MESSAGES } from "@/features/training-notes/constants/messages";
import { isValidDate } from "@/utils/week";

// An empty optional number arrives as null (or undefined) from the form.
const optionalInt = (min: number, max: number, message: string) =>
  z
    .number({ error: message })
    .int(message)
    .min(min, message)
    .max(max, message)
    .nullish()
    .transform((value) => value ?? null);

// Blank text is stored as null.
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((value) => (value ? value : null));

const setSchema = z
  .object({
    unit: z.enum(["reps", "seconds"]),
    reps: optionalInt(REPS_MIN, REPS_MAX, MESSAGES.REPS_RANGE),
    durationSec: optionalInt(
      DURATION_MIN_SEC,
      DURATION_MAX_SEC,
      MESSAGES.DURATION_RANGE,
    ),
    weightKg: z
      .number({ error: MESSAGES.WEIGHT_RANGE })
      .min(WEIGHT_MIN_KG, MESSAGES.WEIGHT_RANGE)
      .max(WEIGHT_MAX_KG, MESSAGES.WEIGHT_RANGE)
      .nullish()
      .transform((value) => value ?? null),
    note: optionalText(SET_NOTE_MAX, MESSAGES.SET_NOTE_TOO_LONG),
  })
  // A set is counted in one unit: the value of the other must be empty.
  .refine(
    (set) => (set.unit === "reps" ? set.durationSec : set.reps) === null,
    { message: MESSAGES.REPS_OR_DURATION, path: ["durationSec"] },
  );

type ParsedSet = z.infer<typeof setSchema>;

const itemSchema = z.object({
  exerciseName: z
    .string()
    .trim()
    .max(EXERCISE_NAME_MAX, MESSAGES.EXERCISE_NAME_TOO_LONG),
  sets: z.array(setSchema).max(SETS_PER_ITEM_MAX, MESSAGES.TOO_MANY_SETS),
});

const getSetValue = (set: ParsedSet) =>
  set.unit === "reps" ? set.reps : set.durationSec;

// The form keeps spare set rows: one with nothing in it (no value, no kg, no
// note) is dropped. A set with only kg or only a note is kept. Legacy
// count-only rows (sets = N, no values) read as N blank sets, so re-saving
// such a note drops them.
const isBlankSet = (set: ParsedSet) =>
  getSetValue(set) === null && set.weightKg === null && set.note === null;

type ParsedItem = z.infer<typeof itemSchema>;

export const trainingNoteSchema = z
  .object({
    id: z.number().int().positive().optional(),
    date: z.string().refine(isValidDate, MESSAGES.DATE_INVALID),
    title: optionalText(NOTE_TITLE_MAX, MESSAGES.TITLE_TOO_LONG),
    note: optionalText(NOTE_TEXT_MAX, MESSAGES.NOTE_TOO_LONG),
    items: z.array(itemSchema).max(NOTE_MAX_ITEMS, MESSAGES.TOO_MANY_ITEMS),
  })
  .transform((input, context) => {
    // The form always keeps one empty row: rows with nothing in them are
    // dropped, but a row with sets and no name is a mistake to report. A named
    // exercise without sets is allowed (just the name).
    const items: ParsedItem[] = [];

    input.items.forEach((item, itemIndex) => {
      const filled = item.sets.filter((set) => !isBlankSet(set));

      if (item.exerciseName === "" && filled.length === 0) {
        return;
      }
      if (item.exerciseName === "") {
        context.issues.push({
          code: "custom",
          message: MESSAGES.EXERCISE_NAME_REQUIRED,
          input: item,
          path: ["items", itemIndex, "exerciseName"],
        });
      }
      items.push({ exerciseName: item.exerciseName, sets: filled });
    });

    if (items.length === 0 && input.note === null) {
      context.issues.push({
        code: "custom",
        message: MESSAGES.EMPTY,
        input,
        path: ["note"],
      });
    }
    return { ...input, items };
  });

export type TrainingNoteInput = z.input<typeof trainingNoteSchema>;
export type ParsedTrainingNote = z.output<typeof trainingNoteSchema>;
