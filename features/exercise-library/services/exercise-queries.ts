import "server-only";

import { and, count, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { exerciseLibrary } from "@/db/schema";
import { catalogImageUrl } from "@/features/exercise-library/constants/catalog-source";
import type { MuscleKey } from "@/features/exercise-library/constants/muscles";
import {
  CATALOG,
  type CatalogExercise,
  findCatalogExercise,
} from "@/features/exercise-library/services/exercise-catalog";
import type {
  ExerciseDetail,
  ExerciseMuscles,
  ExerciseRow,
  ExerciseSource,
} from "@/features/exercise-library/types/exercise";
import { exercisePhotoUrl } from "@/features/exercise-library/utils/exercise-photo";
import {
  formatExerciseRef,
  parseExerciseRef,
} from "@/features/exercise-library/utils/exercise-ref";
import { rankExercises } from "@/features/exercise-library/utils/exercise-search";
import {
  parseMuscleColumn,
  splitMuscles,
} from "@/features/exercise-library/utils/muscles";
import { toNameKey } from "@/utils/name";

// Lists never carry the photo bytes.
const customColumns = {
  id: exerciseLibrary.id,
  name: exerciseLibrary.name,
  primaryMuscles: exerciseLibrary.primaryMuscles,
  secondaryMuscles: exerciseLibrary.secondaryMuscles,
  equipment: exerciseLibrary.equipment,
  instructions: exerciseLibrary.instructions,
  photoSize: exerciseLibrary.photoSize,
  updatedAt: exerciseLibrary.updatedAt,
};

type CustomRecord = {
  id: number;
  name: string;
  primaryMuscles: string;
  secondaryMuscles: string;
  equipment: string | null;
  instructions: string | null;
  photoSize: number | null;
  updatedAt: Date;
};

export const toCustomRow = (record: CustomRecord): ExerciseRow => ({
  ref: formatExerciseRef("custom", record.id),
  name: record.name,
  ...splitMuscles(
    parseMuscleColumn(record.primaryMuscles),
    parseMuscleColumn(record.secondaryMuscles),
  ),
  equipment: record.equipment,
  imageUrl: exercisePhotoUrl(
    record.id,
    record.photoSize !== null,
    record.updatedAt,
  ),
  isCustom: true,
});

const toCatalogRow = (entry: CatalogExercise): ExerciseRow => ({
  ref: formatExerciseRef("builtin", entry.id),
  name: entry.name,
  primary: entry.primary,
  secondary: entry.secondary,
  equipment: entry.equipment,
  imageUrl: catalogImageUrl(entry.image),
  isCustom: false,
});

// Each admin keeps their own exercises; the id is always in the query.
const listCustom = (adminId: number) =>
  db
    .select(customColumns)
    .from(exerciseLibrary)
    .where(eq(exerciseLibrary.adminId, adminId));

interface SearchParams {
  q: string;
  muscle?: MuscleKey;
  source: ExerciseSource;
  limit: number;
}

// Built-ins plus the admin's own exercises, ranked by `rankExercises`.
export const searchExerciseRows = async (
  adminId: number,
  { q, muscle, source, limit }: SearchParams,
): Promise<ExerciseRow[]> => {
  const custom =
    source === "builtin"
      ? []
      : (await listCustom(adminId)).map((record) => ({
          row: toCustomRow(record),
          nameKey: toNameKey(record.name),
        }));
  const builtin =
    source === "mine"
      ? []
      : CATALOG.map((entry) => ({
          row: toCatalogRow(entry),
          nameKey: entry.nameKey,
        }));

  return rankExercises(
    [...custom, ...builtin].map(({ row, nameKey }) => ({
      row,
      nameKey,
      ...row,
    })),
    { q, muscle, limit },
  ).map((entry) => entry.row);
};

// One exercise by ref. A custom exercise of another admin, a deleted one and
// an unknown built-in all read as null.
export const getExerciseDetail = async (
  adminId: number,
  ref: string,
): Promise<ExerciseDetail | null> => {
  const parsed = parseExerciseRef(ref);

  if (!parsed) {
    return null;
  }
  if (parsed.kind === "builtin") {
    const entry = findCatalogExercise(parsed.id);

    return entry
      ? {
          ...toCatalogRow(entry),
          instructions: entry.instructions,
          category: entry.category,
          level: entry.level,
          customId: null,
        }
      : null;
  }
  const [record] = await db
    .select(customColumns)
    .from(exerciseLibrary)
    .where(
      and(
        eq(exerciseLibrary.id, parsed.id),
        eq(exerciseLibrary.adminId, adminId),
      ),
    );

  return record
    ? {
        ...toCustomRow(record),
        instructions: (record.instructions ?? "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        category: null,
        level: null,
        customId: record.id,
      }
    : null;
};

// The muscles of the refs that still exist for this admin, keyed by ref. Refs
// that are malformed, unknown, deleted or owned by someone else are absent, so
// callers treat them as "no link".
export const findExerciseMuscles = async (
  adminId: number,
  refs: (string | null)[],
): Promise<Map<string, ExerciseMuscles>> => {
  const found = new Map<string, ExerciseMuscles>();
  const customIds = new Set<number>();

  for (const ref of new Set(refs)) {
    const parsed = parseExerciseRef(ref);

    if (parsed?.kind === "builtin") {
      const entry = findCatalogExercise(parsed.id);

      if (entry) {
        found.set(formatExerciseRef("builtin", entry.id), {
          primary: entry.primary,
          secondary: entry.secondary,
        });
      }
    } else if (parsed) {
      customIds.add(parsed.id);
    }
  }
  if (customIds.size > 0) {
    const records = await db
      .select({
        id: exerciseLibrary.id,
        primaryMuscles: exerciseLibrary.primaryMuscles,
        secondaryMuscles: exerciseLibrary.secondaryMuscles,
      })
      .from(exerciseLibrary)
      .where(
        and(
          eq(exerciseLibrary.adminId, adminId),
          inArray(exerciseLibrary.id, [...customIds]),
        ),
      );

    for (const record of records) {
      found.set(
        formatExerciseRef("custom", record.id),
        splitMuscles(
          parseMuscleColumn(record.primaryMuscles),
          parseMuscleColumn(record.secondaryMuscles),
        ),
      );
    }
  }
  return found;
};

// The photo bytes of one custom exercise of this admin.
export const findExercisePhoto = async (adminId: number, id: number) => {
  const [record] = await db
    .select({
      mime: exerciseLibrary.photoMime,
      data: exerciseLibrary.photoData,
    })
    .from(exerciseLibrary)
    .where(
      and(eq(exerciseLibrary.id, id), eq(exerciseLibrary.adminId, adminId)),
    );

  return record?.mime && record.data
    ? { mime: record.mime, data: record.data }
    : null;
};

export const countCustomExercises = async (adminId: number) => {
  const [row] = await db
    .select({ total: count() })
    .from(exerciseLibrary)
    .where(eq(exerciseLibrary.adminId, adminId));

  return row.total;
};
