import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { TIME_ZONE } from "@/constants/time";
import { db } from "@/db";
import {
  adminTrainingNoteItems,
  adminTrainingNotes,
  adminTrainingNoteSets,
} from "@/db/schema";
import type {
  TrainingNote,
  TrainingNoteRange,
} from "@/features/training-notes/types/training-note";
import { getRangeBounds } from "@/features/training-notes/utils/note-filters";
import { toItemSets } from "@/features/training-notes/utils/note-sets";
import { getTodayDate } from "@/utils/week";

// Enough for years of sessions; the list is a log, not an archive browser.
const NOTES_LIMIT = 500;

// "50%" must search for a literal percent sign, not everything.
export const toLikePattern = (query: string) =>
  `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

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
  const search = q.trim();
  const pattern = toLikePattern(search);
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
        // Searched before the limit, so an old match is never cut off.
        search === ""
          ? undefined
          : or(
              sql`${adminTrainingNotes.title} LIKE ${pattern} ESCAPE '\\'`,
              sql`${adminTrainingNotes.note} LIKE ${pattern} ESCAPE '\\'`,
              exists(
                db
                  .select({ one: sql`1` })
                  .from(adminTrainingNoteItems)
                  .where(
                    and(
                      eq(adminTrainingNoteItems.noteId, adminTrainingNotes.id),
                      sql`${adminTrainingNoteItems.exerciseName} LIKE ${pattern} ESCAPE '\\'`,
                    ),
                  ),
              ),
            ),
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

  // Sets of all listed exercises in one query; exercises without rows fall
  // back to their legacy columns.
  const setRows =
    items.length === 0
      ? []
      : await db
          .select({
            itemId: adminTrainingNoteSets.itemId,
            position: adminTrainingNoteSets.position,
            reps: adminTrainingNoteSets.reps,
            durationSec: adminTrainingNoteSets.durationSec,
            weightKg: adminTrainingNoteSets.weightKg,
            note: adminTrainingNoteSets.note,
          })
          .from(adminTrainingNoteSets)
          .where(
            inArray(
              adminTrainingNoteSets.itemId,
              items.map((item) => item.id),
            ),
          )
          .orderBy(
            asc(adminTrainingNoteSets.itemId),
            asc(adminTrainingNoteSets.position),
          );
  const setsByItem = Map.groupBy(setRows, (row) => row.itemId);

  return notes.map((note) => ({
    ...note,
    items: items
      .filter((item) => item.noteId === note.id)
      .map((item) => ({
        id: item.id,
        position: item.position,
        exerciseName: item.exerciseName,
        sets: toItemSets(item, setsByItem.get(item.id) ?? []),
      })),
  }));
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
