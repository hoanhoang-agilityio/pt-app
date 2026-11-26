"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ROUTES } from "@/constants/routes";
import { db } from "@/db";
import {
  adminTrainingNoteItems,
  adminTrainingNotes,
  adminTrainingNoteSets,
} from "@/db/schema";
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Deletes the exercises of a note and their sets, sets first.
const deleteItemsWithSets = async (tx: Tx, noteId: number) => {
  const existing = await tx
    .select({ id: adminTrainingNoteItems.id })
    .from(adminTrainingNoteItems)
    .where(eq(adminTrainingNoteItems.noteId, noteId));

  if (existing.length > 0) {
    await tx.delete(adminTrainingNoteSets).where(
      inArray(
        adminTrainingNoteSets.itemId,
        existing.map((row) => row.id),
      ),
    );
  }
  await tx
    .delete(adminTrainingNoteItems)
    .where(eq(adminTrainingNoteItems.noteId, noteId));
};

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
        // No cascade in production (foreign keys are off): sets first.
        await deleteItemsWithSets(tx, noteId);
      }
      if (items.length > 0) {
        // The legacy sets/reps/duration/weight columns are no longer written.
        const inserted = await tx
          .insert(adminTrainingNoteItems)
          .values(
            items.map((item, position) => ({
              noteId,
              position,
              exerciseName: item.exerciseName,
            })),
          )
          .returning({
            id: adminTrainingNoteItems.id,
            position: adminTrainingNoteItems.position,
          });
        const itemIds = new Map(inserted.map((row) => [row.position, row.id]));
        // The unit is not stored: duration_sec set means a timed set.
        const setRows = items.flatMap((item, itemPosition) =>
          item.sets.map((set, position) => ({
            itemId: itemIds.get(itemPosition) as number,
            position,
            reps: set.unit === "reps" ? set.reps : null,
            durationSec: set.unit === "seconds" ? set.durationSec : null,
            weightKg: set.weightKg,
            note: set.note,
          })),
        );

        if (setRows.length > 0) {
          await tx.insert(adminTrainingNoteSets).values(setRows);
        }
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

// Deletes one of the caller's notes with its exercises and sets. Cascade does
// not fire in production, so the children are deleted explicitly, in one
// transaction, after the owner check.
export const deleteTrainingNoteAction = withResultErrorHandling(
  "deleteTrainingNote",
  async (noteId: number) => {
    const admin = await requireAdmin();

    const id = noteIdSchema.safeParse(noteId);

    if (!id.success) {
      return notFound();
    }
    const deleted = await db.transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: adminTrainingNotes.id })
        .from(adminTrainingNotes)
        .where(
          and(
            eq(adminTrainingNotes.id, id.data),
            eq(adminTrainingNotes.adminId, admin.id),
          ),
        );

      if (!owned) {
        return false;
      }
      await deleteItemsWithSets(tx, owned.id);
      await tx
        .delete(adminTrainingNotes)
        .where(eq(adminTrainingNotes.id, owned.id));
      return true;
    });

    if (!deleted) {
      return notFound();
    }
    revalidatePath(ROUTES.ADMIN_NOTES);
    return { status: "success" as const };
  },
);
