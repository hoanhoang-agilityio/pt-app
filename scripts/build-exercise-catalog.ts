// Builds features/exercise-library/constants/catalog.json from the
// free-exercise-db dump (https://github.com/yuhonas/free-exercise-db,
// Unlicense / public domain, 876 exercises).
//
//   pnpm tsx scripts/build-exercise-catalog.ts [path-to-exercises.json]
//
// Without an argument the dump is downloaded from GitHub. Output is committed;
// the app never fetches the source at runtime. Muscles are mapped to our 17
// snake_case keys, so the file can be read without translation.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  CATALOG_MUSCLE_NAMES,
  MUSCLE_KEYS,
  type MuscleKey,
} from "../features/exercise-library/constants/muscles";

const SOURCE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const OUTPUT = join(
  process.cwd(),
  "features/exercise-library/constants/catalog.json",
);

interface SourceExercise {
  id: string;
  name: string;
  equipment: string | null;
  category: string;
  level: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

const toKey = (name: string): MuscleKey => {
  const key = CATALOG_MUSCLE_NAMES[name] ?? name;

  if (!(MUSCLE_KEYS as readonly string[]).includes(key)) {
    throw new Error(`Unknown muscle "${name}"`);
  }
  return key as MuscleKey;
};

const load = async (): Promise<SourceExercise[]> => {
  const file = process.argv[2];

  if (file) {
    return JSON.parse(await readFile(file, "utf8"));
  }
  const response = await fetch(SOURCE_URL);

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  return response.json();
};

const main = async () => {
  const source = await load();
  const catalog = source.map((item) => {
    // A few entries repeat a muscle or list it as both primary and secondary.
    const primary = [...new Set(item.primaryMuscles.map(toKey))];
    const secondary = [...new Set(item.secondaryMuscles.map(toKey))].filter(
      (key) => !primary.includes(key),
    );

    return {
      id: item.id,
      name: item.name,
      primary,
      secondary,
      equipment: item.equipment,
      category: item.category,
      level: item.level,
      instructions: item.instructions,
      image: item.images[0] ?? null,
    };
  });

  await writeFile(OUTPUT, `${JSON.stringify(catalog)}\n`);
  console.log(`Wrote ${catalog.length} exercises to ${OUTPUT}`);
};

void main();
