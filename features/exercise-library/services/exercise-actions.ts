"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { db } from "@/db";
import { exerciseLibrary } from "@/db/schema";
import { EXERCISE_CUSTOM_MAX } from "@/features/exercise-library/constants/limits";
import { EXERCISE_MESSAGES } from "@/features/exercise-library/constants/messages";
import {
  type ExerciseInput,
  exerciseIdSchema,
  exerciseInputSchema,
  type ParsedExerciseInput,
  type SearchInput,
  searchInputSchema,
} from "@/features/exercise-library/services/exercise-schemas";
import {
  getExerciseDetail,
  searchExerciseRows,
} from "@/features/exercise-library/services/exercise-queries";
import type {
  ExerciseDetail,
  ExerciseRow,
} from "@/features/exercise-library/types/exercise";
import { formatExerciseRef } from "@/features/exercise-library/utils/exercise-ref";
import { decodeExercisePhoto } from "@/features/exercise-library/utils/exercise-photo";
import { withResultErrorHandling } from "@/services/action-errors";
import { requireAdmin } from "@/services/auth-guard";
import type { ActionErrorResult } from "@/types/error";

const fail = (message: string): ActionErrorResult => ({
  status: "error",
  message,
});

const notFound = () => fail(EXERCISE_MESSAGES.NOT_FOUND);

const firstIssue = (error: { issues: { message: string }[] }) =>
  fail(error.issues[0]?.message || EXERCISE_MESSAGES.INVALID_INPUT);

// Columns written for the photo: untouched for undefined, cleared for null.
const photoColumns = (photo: ParsedExerciseInput["photo"]) => {
  if (photo === undefined) {
    return { ok: true as const, values: {} };
  }
  if (photo === null) {
    return {
      ok: true as const,
      values: {
        photoMime: null,
        photoWidth: null,
        photoHeight: null,
        photoData: null,
        photoSize: null,
      },
    };
  }
  const decoded = decodeExercisePhoto(photo);

  if (!decoded.ok) {
    return {
      ok: false as const,
      message:
        decoded.reason === "too-large"
          ? EXERCISE_MESSAGES.PHOTO_TOO_LARGE
          : EXERCISE_MESSAGES.PHOTO_INVALID,
    };
  }
  return {
    ok: true as const,
    values: {
      photoMime: decoded.mime,
      photoWidth: decoded.width,
      photoHeight: decoded.height,
      photoData: Buffer.from(decoded.bytes),
      photoSize: decoded.bytes.length,
    },
  };
};

const revalidate = () => revalidatePath(ROUTES.ADMIN_EXERCISES);

// Search for the library page and the note picker: the built-in catalog plus
// the caller's own exercises.
export const searchExercises = withResultErrorHandling(
  "searchExercises",
  async (
    input: SearchInput,
  ): Promise<
    { status: "success"; rows: ExerciseRow[] } | ActionErrorResult
  > => {
    const admin = await requireAdmin();
    const parsed = searchInputSchema.safeParse(input);

    if (!parsed.success) {
      return fail(EXERCISE_MESSAGES.INVALID_INPUT);
    }
    return {
      status: "success",
      rows: await searchExerciseRows(admin.id, parsed.data),
    };
  },
);

export const getExercise = withResultErrorHandling(
  "getExercise",
  async (
    ref: string,
  ): Promise<
    { status: "success"; exercise: ExerciseDetail } | ActionErrorResult
  > => {
    const admin = await requireAdmin();
    const exercise = await getExerciseDetail(admin.id, ref);

    return exercise ? { status: "success", exercise } : notFound();
  },
);

export const createExercise = withResultErrorHandling(
  "createExercise",
  async (
    input: ExerciseInput,
  ): Promise<{ status: "success"; ref: string } | ActionErrorResult> => {
    const admin = await requireAdmin();
    const parsed = exerciseInputSchema.safeParse(input);

    if (!parsed.success) {
      return firstIssue(parsed.error);
    }
    const photo = photoColumns(parsed.data.photo);

    if (!photo.ok) {
      return fail(photo.message);
    }
    const [{ total }] = await db
      .select({ total: count() })
      .from(exerciseLibrary)
      .where(eq(exerciseLibrary.adminId, admin.id));

    if (total >= EXERCISE_CUSTOM_MAX) {
      return fail(EXERCISE_MESSAGES.TOO_MANY);
    }
    const { name, primary, secondary, equipment, instructions } = parsed.data;
    const [created] = await db
      .insert(exerciseLibrary)
      .values({
        adminId: admin.id,
        name,
        primaryMuscles: JSON.stringify(primary),
        secondaryMuscles: JSON.stringify(secondary),
        equipment,
        instructions,
        ...photo.values,
      })
      .returning({ id: exerciseLibrary.id });

    revalidate();
    return { status: "success", ref: formatExerciseRef("custom", created.id) };
  },
);

// Updates one of the caller's exercises; an id that is missing or belongs to
// someone else is "not found", never edited.
export const updateExercise = withResultErrorHandling(
  "updateExercise",
  async (
    id: number,
    input: ExerciseInput,
  ): Promise<{ status: "success" } | ActionErrorResult> => {
    const admin = await requireAdmin();
    const exerciseId = exerciseIdSchema.safeParse(id);

    if (!exerciseId.success) {
      return notFound();
    }
    const parsed = exerciseInputSchema.safeParse(input);

    if (!parsed.success) {
      return firstIssue(parsed.error);
    }
    const photo = photoColumns(parsed.data.photo);

    if (!photo.ok) {
      return fail(photo.message);
    }
    const { name, primary, secondary, equipment, instructions } = parsed.data;
    const [updated] = await db
      .update(exerciseLibrary)
      .set({
        name,
        primaryMuscles: JSON.stringify(primary),
        secondaryMuscles: JSON.stringify(secondary),
        equipment,
        instructions,
        ...photo.values,
        updatedAt: sql`(unixepoch())`,
      })
      .where(
        and(
          eq(exerciseLibrary.id, exerciseId.data),
          eq(exerciseLibrary.adminId, admin.id),
        ),
      )
      .returning({ id: exerciseLibrary.id });

    if (!updated) {
      return notFound();
    }
    revalidate();
    return { status: "success" };
  },
);

// Deletes one of the caller's exercises. Note items that point at it keep
// their exercise name; their ref reads as "no link" from now on.
export const deleteExercise = withResultErrorHandling(
  "deleteExercise",
  async (id: number): Promise<{ status: "success" } | ActionErrorResult> => {
    const admin = await requireAdmin();
    const exerciseId = exerciseIdSchema.safeParse(id);

    if (!exerciseId.success) {
      return notFound();
    }
    const [deleted] = await db
      .delete(exerciseLibrary)
      .where(
        and(
          eq(exerciseLibrary.id, exerciseId.data),
          eq(exerciseLibrary.adminId, admin.id),
        ),
      )
      .returning({ id: exerciseLibrary.id });

    if (!deleted) {
      return notFound();
    }
    revalidate();
    return { status: "success" };
  },
);
