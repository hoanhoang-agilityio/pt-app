import "server-only";

import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { userRestrictions } from "@/db/schema";
import type { ActiveRestriction } from "@/features/restrictions/types/restriction";

// A row is active when it is not lifted and has no end or an end in the
// future. The same rule as isRestrictionActive, as SQL.
export const activeRestrictionWhere = (now: Date) =>
  and(
    isNull(userRestrictions.liftedAt),
    or(isNull(userRestrictions.until), gt(userRestrictions.until, now)),
  );

type Row = typeof userRestrictions.$inferSelect;

const toActive = (row: Row): ActiveRestriction => ({
  id: row.id,
  userId: row.userId,
  level: row.level,
  until: row.until?.getTime() ?? null,
  reason: row.reason,
  createdAt: row.createdAt.getTime(),
});

// Suspension first, then the newest: what applies if data ever holds two.
const byPrecedence = (a: Row, b: Row) =>
  Number(b.level === "suspended") - Number(a.level === "suspended") ||
  b.createdAt.getTime() - a.createdAt.getTime();

// The restriction that applies to one trainee right now, or null.
export const findActiveRestriction = async (
  userId: number,
  now: Date = new Date(),
): Promise<ActiveRestriction | null> => {
  const rows = await db
    .select()
    .from(userRestrictions)
    .where(
      and(eq(userRestrictions.userId, userId), activeRestrictionWhere(now)),
    )
    .orderBy(desc(userRestrictions.createdAt));
  const [row] = rows.sort(byPrecedence);

  return row ? toActive(row) : null;
};

// Once per request: the session guard and the trainee layout both ask.
export const getRequestRestriction = cache((userId: number) =>
  findActiveRestriction(userId),
);

// Active restrictions of several trainees (the admin list), by user id.
export const listActiveRestrictions = async (
  userIds: number[],
  now: Date = new Date(),
): Promise<Map<number, ActiveRestriction>> => {
  if (userIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select()
    .from(userRestrictions)
    .where(
      and(
        inArray(userRestrictions.userId, userIds),
        activeRestrictionWhere(now),
      ),
    );

  // Worst first, so the first row per user is the one that applies.
  const result = new Map<number, ActiveRestriction>();

  for (const row of rows.sort(byPrecedence)) {
    if (!result.has(row.userId)) {
      result.set(row.userId, toActive(row));
    }
  }
  return result;
};

// Trainees who cannot sign in and are hidden from other trainees.
export const listSuspendedUserIds = async (
  now: Date = new Date(),
): Promise<number[]> => {
  const rows = await db
    .selectDistinct({ userId: userRestrictions.userId })
    .from(userRestrictions)
    .where(
      and(eq(userRestrictions.level, "suspended"), activeRestrictionWhere(now)),
    );

  return rows.map((row) => row.userId);
};
