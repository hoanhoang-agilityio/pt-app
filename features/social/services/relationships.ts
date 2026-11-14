import "server-only";

import { and, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { socialBlocks, socialFriendships } from "@/db/schema";
import { listSuspendedUserIds } from "@/features/restrictions/services/restriction-queries";
import type { Relationship } from "@/features/social/utils/friend-rules";
import { pairOf } from "@/features/social/utils/friend-rules";

// Friendships and blocks between two trainees: the one place the visibility
// context, the feed, the profile and the friend actions read them from.
// Admins have neither (they are default friends by role, spec Q4).

export const findFriendship = async (a: number, b: number) => {
  const { low, high } = pairOf(a, b);
  const [row] = await db
    .select()
    .from(socialFriendships)
    .where(
      and(
        eq(socialFriendships.userLow, low),
        eq(socialFriendships.userHigh, high),
      ),
    )
    .limit(1);

  return row ?? null;
};

// Either side blocked the other, or either one is suspended by an admin: a
// suspended trainee is hidden from everyone else like a blocked one, in the
// feed, friend lists, search, profiles and chats.
export const isBlockedBetween = async (a: number, b: number) => {
  const suspended = await listSuspendedUserIds();

  if (suspended.includes(a) || suspended.includes(b)) {
    return true;
  }
  const [row] = await db
    .select({ blockerId: socialBlocks.blockerId })
    .from(socialBlocks)
    .where(
      or(
        and(eq(socialBlocks.blockerId, a), eq(socialBlocks.blockedId, b)),
        and(eq(socialBlocks.blockerId, b), eq(socialBlocks.blockedId, a)),
      ),
    )
    .limit(1);

  return Boolean(row);
};

// What canSeePost needs about two trainees, in at most two small queries.
export const loadPairState = async (viewerId: number, otherId: number) => {
  if (viewerId === otherId) {
    return { areFriends: false, isBlocked: false };
  }
  const [friendship, isBlocked] = await Promise.all([
    findFriendship(viewerId, otherId),
    isBlockedBetween(viewerId, otherId),
  ]);

  return {
    areFriends: friendship?.status === "accepted" && !isBlocked,
    isBlocked,
  };
};

export const getRelationship = async (
  viewerId: number,
  otherId: number,
): Promise<Relationship> => {
  if (viewerId === otherId) {
    return "self";
  }
  const friendship = await findFriendship(viewerId, otherId);

  if (!friendship) {
    return "none";
  }
  if (friendship.status === "accepted") {
    return "friends";
  }
  return friendship.requestedBy === viewerId ? "sent" : "received";
};

// Ids of the trainees in an accepted friendship with `userId`, minus anyone
// blocked either way (a block ends the friendship, this is belt and braces).
export const listFriendIds = async (userId: number): Promise<number[]> => {
  const [rows, blocked] = await Promise.all([
    db
      .select()
      .from(socialFriendships)
      .where(
        and(
          eq(socialFriendships.status, "accepted"),
          or(
            eq(socialFriendships.userLow, userId),
            eq(socialFriendships.userHigh, userId),
          ),
        ),
      ),
    listBlockedBetweenIds(userId),
  ]);

  return rows
    .map((row) => (row.userLow === userId ? row.userHigh : row.userLow))
    .filter((id) => !blocked.has(id));
};

// Everyone who blocked `userId` or whom `userId` blocked, plus every trainee
// an admin suspended (hidden from all other trainees).
export const listBlockedBetweenIds = async (
  userId: number,
): Promise<Set<number>> => {
  const [rows, suspended] = await Promise.all([
    db
      .select()
      .from(socialBlocks)
      .where(
        or(
          eq(socialBlocks.blockerId, userId),
          eq(socialBlocks.blockedId, userId),
        ),
      ),
    listSuspendedUserIds(),
  ]);
  const ids = new Set(
    rows.map((row) =>
      row.blockerId === userId ? row.blockedId : row.blockerId,
    ),
  );

  for (const id of suspended) {
    if (id !== userId) {
      ids.add(id);
    }
  }
  return ids;
};

export const countFriends = async (userId: number) =>
  (await listFriendIds(userId)).length;
