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
  SETS_MAX,
  SETS_MIN,
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

const itemSchema = z
  .object({
    exerciseName: z
      .string()
      .trim()
      .max(EXERCISE_NAME_MAX, MESSAGES.EXERCISE_NAME_TOO_LONG),
    sets: optionalInt(SETS_MIN, SETS_MAX, MESSAGES.SETS_REPS_RANGE),
    reps: optionalInt(REPS_MIN, REPS_MAX, MESSAGES.SETS_REPS_RANGE),
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
  })
  .refine((item) => item.reps === null || item.durationSec === null, {
    message: MESSAGES.REPS_OR_DURATION,
    path: ["durationSec"],
  });

// Blank text is stored as null.
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((value) => (value ? value : null));

const isBlankItem = (item: z.infer<typeof itemSchema>) =>
  item.exerciseName === "" &&
  item.sets === null &&
  item.reps === null &&
  item.durationSec === null &&
  item.weightKg === null;

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
    // dropped, but a row with numbers and no name is a mistake to report.
    const items = input.items.filter((item) => !isBlankItem(item));

    items.forEach((item, index) => {
      if (item.exerciseName === "") {
        context.issues.push({
          code: "custom",
          message: MESSAGES.EXERCISE_NAME_REQUIRED,
          input: item,
          path: ["items", index, "exerciseName"],
        });
      }
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
