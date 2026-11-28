import { z } from "zod";

import {
  EXERCISE_EQUIPMENT_MAX,
  EXERCISE_INSTRUCTIONS_MAX,
  EXERCISE_NAME_MAX,
  PHOTO_MAX_DATA_URL_LENGTH,
  SEARCH_LIMIT_DEFAULT,
  SEARCH_LIMIT_MAX,
  SEARCH_QUERY_MAX,
} from "@/features/exercise-library/constants/limits";
import { EXERCISE_MESSAGES as MESSAGES } from "@/features/exercise-library/constants/messages";
import { MUSCLE_KEYS } from "@/features/exercise-library/constants/muscles";

const muscleSchema = z.enum(MUSCLE_KEYS, { error: MESSAGES.MUSCLE_INVALID });
const muscleList = z
  .array(muscleSchema, { error: MESSAGES.MUSCLE_INVALID })
  .max(MUSCLE_KEYS.length, MESSAGES.MUSCLE_INVALID);

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((value) => (value ? value : null));

export const exerciseInputSchema = z
  .object({
    name: z
      .string({ error: MESSAGES.NAME_REQUIRED })
      .trim()
      .min(1, MESSAGES.NAME_REQUIRED)
      .max(EXERCISE_NAME_MAX, MESSAGES.NAME_TOO_LONG),
    primary: muscleList.default([]),
    secondary: muscleList.default([]),
    equipment: optionalText(
      EXERCISE_EQUIPMENT_MAX,
      MESSAGES.EQUIPMENT_TOO_LONG,
    ),
    instructions: optionalText(
      EXERCISE_INSTRUCTIONS_MAX,
      MESSAGES.INSTRUCTIONS_TOO_LONG,
    ),
    // undefined keeps the current photo (update), null removes it, a data URL
    // replaces it.
    photo: z
      .string()
      .max(PHOTO_MAX_DATA_URL_LENGTH, MESSAGES.PHOTO_TOO_LARGE)
      .nullable()
      .optional(),
  })
  .transform((input) => {
    const primary = [...new Set(input.primary)];

    return {
      ...input,
      primary,
      // A muscle is primary or secondary, not both.
      secondary: [...new Set(input.secondary)].filter(
        (key) => !primary.includes(key),
      ),
    };
  });

export type ExerciseInput = z.input<typeof exerciseInputSchema>;
export type ParsedExerciseInput = z.output<typeof exerciseInputSchema>;

export const exerciseIdSchema = z.number().int().positive();

export const searchInputSchema = z.object({
  q: z.string().max(SEARCH_QUERY_MAX).default(""),
  muscle: muscleSchema.optional(),
  source: z.enum(["all", "mine", "builtin"]).default("all"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(SEARCH_LIMIT_MAX)
    .default(SEARCH_LIMIT_DEFAULT),
});

export type SearchInput = z.input<typeof searchInputSchema>;
