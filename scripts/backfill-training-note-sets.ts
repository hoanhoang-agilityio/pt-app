// Moves legacy training-note exercises (one sets/reps/duration/weight set of
// columns on the item) into per-set rows, then nulls the legacy columns.
//
//   pnpm db:backfill-note-sets
//
// Idempotent: an item that already has set rows, or has nothing in its legacy
// columns, is skipped, so it can be re-run safely. Each item is migrated in
// its own transaction. An item whose legacy count is above SETS_PER_ITEM_MAX
// is skipped (its legacy columns stay intact) and its id is listed, so nothing
// is truncated. First it removes orphans left by earlier deletes (cascade never
// fired): sets whose item is gone (items whose note is gone are removed first).
import { eq, isNotNull, notExists, or } from "drizzle-orm";

import { db } from "@/db";
import {
  adminTrainingNoteItems,
  adminTrainingNotes,
  adminTrainingNoteSets,
} from "@/db/schema";
import { SETS_PER_ITEM_MAX } from "@/features/training-notes/constants/limits";
import { getLegacySets } from "@/features/training-notes/utils/note-sets";

const removeOrphans = async () => {
  // Items whose note is gone first, so their sets become orphans too.
  const orphanItems = await db
    .delete(adminTrainingNoteItems)
    .where(
      notExists(
        db
          .select({ one: adminTrainingNotes.id })
          .from(adminTrainingNotes)
          .where(eq(adminTrainingNotes.id, adminTrainingNoteItems.noteId)),
      ),
    )
    .returning({ id: adminTrainingNoteItems.id });
  const orphanSets = await db
    .delete(adminTrainingNoteSets)
    .where(
      notExists(
        db
          .select({ one: adminTrainingNoteItems.id })
          .from(adminTrainingNoteItems)
          .where(eq(adminTrainingNoteItems.id, adminTrainingNoteSets.itemId)),
      ),
    )
    .returning({ id: adminTrainingNoteSets.id });

  console.log(
    `✔ Removed ${orphanSets.length} orphan set(s) and ${orphanItems.length} orphan exercise(s).`,
  );
};

const backfill = async () => {
  await removeOrphans();
  const legacyItems = await db
    .select({
      id: adminTrainingNoteItems.id,
      sets: adminTrainingNoteItems.sets,
      reps: adminTrainingNoteItems.reps,
      durationSec: adminTrainingNoteItems.durationSec,
      weightKg: adminTrainingNoteItems.weightKg,
    })
    .from(adminTrainingNoteItems)
    .where(
      or(
        isNotNull(adminTrainingNoteItems.sets),
        isNotNull(adminTrainingNoteItems.reps),
        isNotNull(adminTrainingNoteItems.durationSec),
        isNotNull(adminTrainingNoteItems.weightKg),
      ),
    );
  let migrated = 0;
  let skipped = 0;
  const tooMany: number[] = [];

  for (const item of legacyItems) {
    if (item.sets !== null && item.sets > SETS_PER_ITEM_MAX) {
      tooMany.push(item.id);
      continue;
    }
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: adminTrainingNoteSets.id })
        .from(adminTrainingNoteSets)
        .where(eq(adminTrainingNoteSets.itemId, item.id))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        return;
      }
      const sets = getLegacySets(item);

      if (sets.length > 0) {
        await tx.insert(adminTrainingNoteSets).values(
          sets.map((set) => ({
            itemId: item.id,
            position: set.position,
            reps: set.reps,
            durationSec: set.durationSec,
            weightKg: set.weightKg,
            note: null,
          })),
        );
      }
      await tx
        .update(adminTrainingNoteItems)
        .set({ sets: null, reps: null, durationSec: null, weightKg: null })
        .where(eq(adminTrainingNoteItems.id, item.id));
      migrated++;
    });
  }
  console.log(
    `✔ Backfilled ${migrated} exercise(s); ${skipped} already had set rows.`,
  );
  if (tooMany.length > 0) {
    console.log(
      `⚠ Skipped ${tooMany.length} exercise(s) with more than ${SETS_PER_ITEM_MAX} legacy sets (left intact): ids ${tooMany.join(", ")}`,
    );
  }
};

backfill().catch((error: unknown) => {
  console.error("✖ Backfill failed:", error);
  process.exit(1);
});
