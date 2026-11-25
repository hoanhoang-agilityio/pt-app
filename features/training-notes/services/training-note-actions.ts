"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ROUTES } from "@/constants/routes";
import { db } from "@/db";
import { adminTrainingNoteItems, adminTrainingNotes } from "@/db/schema";
import { TRAINING_NOTE_MESSAGES } from "@/features/training-notes/constants/messages";
import {
  type TrainingNoteInput,
  trainingNoteSchema,
} from "@/features/training-notes/utils/note-schema";
import { withResultErrorHandling } from "@/services/action-errors";
import { requireAdmin } from "@/services/auth-guard";
import type { ActionErrorResult } from "@/types/error";

const noteIdSchema = z.number().int().positive();

type SaveTrainingNoteResult =
  { status: "success"; id: number } | ActionErrorResult;

const notFound = (): ActionErrorResult => ({
  status: "error",
  message: TRAINING_NOTE_MESSAGES.NOT_FOUND,
});

// Creates a note, or updates one when `id` is given. Every admin keeps their
// own notes: an id that belongs to someone else is "not found", never edited.
export const saveTrainingNoteAction = withResultErrorHandling(
  "saveTrainingNote",
  async (input: TrainingNoteInput): Promise<SaveTrainingNoteResult> => {
    const admin = await requireAdmin();

    const parsed = trainingNoteSchema.safeParse(input);

    if (!parsed.success) {
      return {
        status: "error",
        message: parsed.error.issues[0]?.message ?? "",
      };
    }
    const { id, date, title, note, items } = parsed.data;

    const savedId = await db.transaction(async (tx) => {
      let noteId: number;

      if (id === undefined) {
        const [created] = await tx
          .insert(adminTrainingNotes)
          .values({ adminId: admin.id, date, title, note })
          .returning({ id: adminTrainingNotes.id });

        noteId = created.id;
      } else {
        const [updated] = await tx
          .update(adminTrainingNotes)
          .set({ date, title, note, updatedAt: sql`(unixepoch())` })
          .where(
            and(
              eq(adminTrainingNotes.id, id),
              eq(adminTrainingNotes.adminId, admin.id),
            ),
          )
          .returning({ id: adminTrainingNotes.id });

        if (!updated) {
          return null;
        }
        noteId = updated.id;
        await tx
          .delete(adminTrainingNoteItems)
          .where(eq(adminTrainingNoteItems.noteId, noteId));
      }
      if (items.length > 0) {
        await tx.insert(adminTrainingNoteItems).values(
          items.map((item, position) => ({
            noteId,
            position,
            exerciseName: item.exerciseName,
            sets: item.sets,
            reps: item.reps,
            durationSec: item.durationSec,
            weightKg: item.weightKg,
          })),
        );
      }
      return noteId;
    });

    if (savedId === null) {
      return notFound();
    }
    revalidatePath(ROUTES.ADMIN_NOTES);
    return { status: "success", id: savedId };
  },
);

// Deletes one of the caller's notes; its exercises go with it (cascade).
export const deleteTrainingNoteAction = withResultErrorHandling(
  "deleteTrainingNote",
  async (noteId: number) => {
    const admin = await requireAdmin();

    const id = noteIdSchema.safeParse(noteId);

    if (!id.success) {
      return notFound();
    }
    const deleted = await db
      .delete(adminTrainingNotes)
      .where(
        and(
          eq(adminTrainingNotes.id, id.data),
          eq(adminTrainingNotes.adminId, admin.id),
        ),
      )
      .returning({ id: adminTrainingNotes.id });

    if (deleted.length === 0) {
      return notFound();
    }
    revalidatePath(ROUTES.ADMIN_NOTES);
    return { status: "success" as const };
  },
);
