import "server-only";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { TIME_ZONE } from "@/constants/time";
import { db } from "@/db";
import { adminTrainingNoteItems, adminTrainingNotes } from "@/db/schema";
import type {
  TrainingNote,
  TrainingNoteRange,
} from "@/features/training-notes/types/training-note";
import {
  getRangeBounds,
  matchesNoteQuery,
} from "@/features/training-notes/utils/note-filters";
import { getTodayDate } from "@/utils/week";

// Enough for years of sessions; the list is a log, not an archive browser.
const NOTES_LIMIT = 500;

interface ListOptions {
  q?: string;
  range?: TrainingNoteRange;
  // "YYYY-MM-DD"; defaults to today in the app time zone.
  today?: string;
}

// The notes of ONE admin, newest day first, with their exercises in order.
// The admin id is always part of the query: notes are private.
export const listTrainingNotes = async (
  adminId: number,
  { q = "", range = "all", today }: ListOptions = {},
): Promise<TrainingNote[]> => {
  const bounds = getRangeBounds(range, today ?? getTodayDate(TIME_ZONE));
  const notes = await db
    .select({
      id: adminTrainingNotes.id,
      date: adminTrainingNotes.date,
      title: adminTrainingNotes.title,
      note: adminTrainingNotes.note,
    })
    .from(adminTrainingNotes)
    .where(
      and(
        eq(adminTrainingNotes.adminId, adminId),
        bounds ? gte(adminTrainingNotes.date, bounds.from) : undefined,
        bounds ? lte(adminTrainingNotes.date, bounds.to) : undefined,
      ),
    )
    .orderBy(desc(adminTrainingNotes.date), desc(adminTrainingNotes.id))
    .limit(NOTES_LIMIT);

  if (notes.length === 0) {
    return [];
  }
  const items = await db
    .select({
      id: adminTrainingNoteItems.id,
      noteId: adminTrainingNoteItems.noteId,
      position: adminTrainingNoteItems.position,
      exerciseName: adminTrainingNoteItems.exerciseName,
      sets: adminTrainingNoteItems.sets,
      reps: adminTrainingNoteItems.reps,
      durationSec: adminTrainingNoteItems.durationSec,
      weightKg: adminTrainingNoteItems.weightKg,
    })
    .from(adminTrainingNoteItems)
    .where(
      inArray(
        adminTrainingNoteItems.noteId,
        notes.map((note) => note.id),
      ),
    )
    .orderBy(
      asc(adminTrainingNoteItems.position),
      asc(adminTrainingNoteItems.id),
    );

  return notes
    .map((note) => ({
      ...note,
      items: items
        .filter((item) => item.noteId === note.id)
        .map((item) => ({
          id: item.id,
          position: item.position,
          exerciseName: item.exerciseName,
          sets: item.sets,
          reps: item.reps,
          durationSec: item.durationSec,
          weightKg: item.weightKg,
        })),
    }))
    .filter((note) => matchesNoteQuery(note, q));
};

const SUGGESTION_LIMIT = 100;

// Exercise names this admin has used before, for the exercise field's
// suggestions (most recent first).
export const listExerciseNames = async (adminId: number): Promise<string[]> => {
  const rows = await db
    .selectDistinct({
      name: adminTrainingNoteItems.exerciseName,
      date: adminTrainingNotes.date,
    })
    .from(adminTrainingNoteItems)
    .innerJoin(
      adminTrainingNotes,
      eq(adminTrainingNoteItems.noteId, adminTrainingNotes.id),
    )
    .where(eq(adminTrainingNotes.adminId, adminId))
    .orderBy(desc(adminTrainingNotes.date))
    .limit(SUGGESTION_LIMIT * 5);

  return [...new Set(rows.map((row) => row.name))].slice(0, SUGGESTION_LIMIT);
};
