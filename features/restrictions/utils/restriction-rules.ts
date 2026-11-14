import { z } from "zod";

import { RESTRICTION_MESSAGES } from "@/features/restrictions/constants/messages";
import {
  RESTRICTION_DURATION_MS,
  RESTRICTION_DURATIONS,
  RESTRICTION_LEVELS,
  RESTRICTION_REASON_MAX,
} from "@/features/restrictions/constants/restrictions";
import type {
  RestrictionDuration,
  RestrictionLevel,
  RestrictionLike,
} from "@/features/restrictions/types/restriction";

// Active while it has not been lifted and has not run out. Computed on every
// read, so an expired restriction simply stops counting (no cron).
export const isRestrictionActive = (
  restriction: Pick<RestrictionLike, "until" | "liftedAt">,
  now: Date = new Date(),
) =>
  restriction.liftedAt === null &&
  (restriction.until === null || restriction.until.getTime() > now.getTime());

// The end of a block started at `now`; null for a permanent one.
export const computeRestrictionUntil = (
  duration: RestrictionDuration,
  now: Date = new Date(),
): Date | null =>
  duration === "permanent"
    ? null
    : new Date(now.getTime() + RESTRICTION_DURATION_MS[duration]);

// Of several rows (there should be one active), the one that applies:
// a suspension beats a restriction, then the newest wins.
export const pickActiveRestriction = <
  T extends RestrictionLike & { createdAt: Date },
>(
  rows: T[],
  now: Date = new Date(),
): T | null => {
  const active = rows.filter((row) => isRestrictionActive(row, now));

  return (
    active.sort(
      (a, b) =>
        Number(b.level === "suspended") - Number(a.level === "suspended") ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )[0] ?? null
  );
};

export const isSuspendedRestriction = (restriction: {
  level: RestrictionLevel;
}) => restriction.level === "suspended";

export const blockUserSchema = z.object({
  userId: z.number().int().positive(),
  level: z.enum(RESTRICTION_LEVELS),
  duration: z.enum(RESTRICTION_DURATIONS),
  reason: z
    .string()
    .trim()
    .min(1, RESTRICTION_MESSAGES.REASON_REQUIRED)
    .max(RESTRICTION_REASON_MAX, RESTRICTION_MESSAGES.REASON_TOO_LONG),
});

export type BlockUserInput = z.infer<typeof blockUserSchema>;

export const liftRestrictionSchema = z.object({
  userId: z.number().int().positive(),
});
