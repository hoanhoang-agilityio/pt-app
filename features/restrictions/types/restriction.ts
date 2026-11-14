import type {
  RESTRICTION_DURATIONS,
  RESTRICTION_LEVELS,
} from "@/features/restrictions/constants/restrictions";

export type RestrictionLevel = (typeof RESTRICTION_LEVELS)[number];

export type RestrictionDuration = (typeof RESTRICTION_DURATIONS)[number];

// The fields the rules need; the table row has more.
export interface RestrictionLike {
  level: RestrictionLevel;
  until: Date | null;
  liftedAt: Date | null;
}

// What the UI shows about an active restriction.
export interface ActiveRestriction {
  id: number;
  userId: number;
  level: RestrictionLevel;
  // Epoch milliseconds, null = permanent. Plain numbers so it can cross into
  // client components.
  until: number | null;
  reason: string;
  createdAt: number;
}
