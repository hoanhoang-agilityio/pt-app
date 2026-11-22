import { z } from "zod";

export const CURSOR_MAX_LENGTH = 300;

// Largest PostgreSQL int4: ids and numeric cursors compared with an integer
// column must fit it, or the query fails with a 500 instead of a clean 400.
export const INT4_MAX = 2_147_483_647;

// One page of a list that can grow. `nextCursor` is opaque: pass it back as
// `?cursor=` for the next page; null on the last page.
export const cursorPageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

export type CursorPage<T> = { items: T[]; nextCursor: string | null };

// `?limit=`: a whole number, `fallback` when omitted.
export const pageLimitSchema = (fallback: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(fallback);

export const cursorSchema = z.string().min(1).max(CURSOR_MAX_LENGTH);
