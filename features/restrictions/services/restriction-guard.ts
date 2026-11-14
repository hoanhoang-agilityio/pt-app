import "server-only";

import { RESTRICTION_MESSAGES } from "@/features/restrictions/constants/messages";
import { findActiveRestriction } from "@/features/restrictions/services/restriction-queries";

// The error to answer with when a trainee under an active restriction tries to
// write (chat, posts, comments, reactions, friend requests), or null when they
// may. Every trainee write action asks this after requireUser().
export const restrictionErrorFor = async (
  userId: number,
): Promise<string | null> =>
  (await findActiveRestriction(userId))
    ? RESTRICTION_MESSAGES.RESTRICTED
    : null;
