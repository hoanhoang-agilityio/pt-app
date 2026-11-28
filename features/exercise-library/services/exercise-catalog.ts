import "server-only";

// Built-in exercises: read-only static data from free-exercise-db (Unlicense),
// built by scripts/build-exercise-catalog.ts. Server only: this file must not
// be imported by client code, or the whole catalog would ship to the browser.
import catalogJson from "@/features/exercise-library/constants/catalog.json";
import type { MuscleKey } from "@/features/exercise-library/constants/muscles";
import { toNameKey } from "@/utils/name";

export interface CatalogExercise {
  id: string;
  name: string;
  nameKey: string;
  primary: MuscleKey[];
  secondary: MuscleKey[];
  equipment: string | null;
  category: string;
  level: string;
  instructions: string[];
  image: string | null;
}

type CatalogEntry = Omit<CatalogExercise, "nameKey">;

export const CATALOG: CatalogExercise[] = (
  catalogJson as unknown as CatalogEntry[]
).map((entry) => ({ ...entry, nameKey: toNameKey(entry.name) }));

const BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));

export const findCatalogExercise = (id: string) => BY_ID.get(id);
