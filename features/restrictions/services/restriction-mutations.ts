import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { userRestrictions, users } from "@/db/schema";
import { activeRestrictionWhere } from "@/features/restrictions/services/restriction-queries";
import {
  type BlockUserInput,
  computeRestrictionUntil,
} from "@/features/restrictions/utils/restriction-rules";

export type RestrictionMutationError = "not_found" | "not_restricted";

// Blocks a trainee. An active restriction is lifted first (it stays as
// history), so there is one active row per trainee. A missing trainee is
// refused before anything is written.
export const applyRestriction = async (
  adminId: number,
  input: BlockUserInput,
  now: Date = new Date(),
): Promise<
  { ok: true; restrictionId: number } | { ok: false; error: "not_found" }
> =>
  db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!user) {
      return { ok: false, error: "not_found" } as const;
    }
    await tx
      .update(userRestrictions)
      .set({ liftedAt: now, liftedByAdminId: adminId })
      .where(
        and(
          eq(userRestrictions.userId, input.userId),
          activeRestrictionWhere(now),
        ),
      );
    const [row] = await tx
      .insert(userRestrictions)
      .values({
        userId: input.userId,
        level: input.level,
        until: computeRestrictionUntil(input.duration, now),
        reason: input.reason,
        createdByAdminId: adminId,
        createdAt: now,
      })
      .returning({ id: userRestrictions.id });

    return { ok: true, restrictionId: row.id } as const;
  });

// Lifts the trainee's active restriction early ("Gỡ chặn").
export const liftRestriction = async (
  adminId: number,
  userId: number,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: "not_restricted" }> => {
  const rows = await db
    .update(userRestrictions)
    .set({ liftedAt: now, liftedByAdminId: adminId })
    .where(
      and(eq(userRestrictions.userId, userId), activeRestrictionWhere(now)),
    )
    .returning({ id: userRestrictions.id });

  return rows.length > 0
    ? { ok: true }
    : { ok: false, error: "not_restricted" };
};

// Member delete: the trainee's restrictions (history included) go with them.
// Call inside the member delete transaction.
export const deleteRestrictionsOfUser = async (
  executor: Pick<typeof db, "delete">,
  userId: number,
) => {
  await executor
    .delete(userRestrictions)
    .where(eq(userRestrictions.userId, userId));
};
