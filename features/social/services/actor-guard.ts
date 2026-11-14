import "server-only";

import { restrictionErrorFor } from "@/features/restrictions/services/restriction-guard";
import {
  actorOfAdmin,
  actorOfUser,
} from "@/features/social/services/post-context";
import { hasAcceptedTerms } from "@/features/social/services/terms";
import type { SocialActor } from "@/features/social/types/social";
import { requireAdmin, requireUser } from "@/services/auth-guard";

export type Who = "user" | "admin";

// A trainee who has not accepted the terms is turned away (null).
export const traineeActor = async (): Promise<SocialActor | null> => {
  const user = await requireUser();

  return hasAcceptedTerms(user) ? actorOfUser(user) : null;
};

export const adminActor = async (): Promise<SocialActor> =>
  actorOfAdmin(await requireAdmin());

export const resolveActor = (who: Who) =>
  who === "admin" ? adminActor() : traineeActor();

// The error for a restricted trainee trying to write (post, comment, react,
// message, friend request), or null. Admins are never restricted. Deleting
// one's own content and reading stay allowed, so those actions skip this.
export const restrictedWriteError = async (
  actor: SocialActor,
): Promise<string | null> =>
  actor.kind === "user" ? restrictionErrorFor(actor.id) : null;
