import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { chatMutes } from "@/db/schema";
import {
  isMuteActive,
  type MuteState,
  toMuteState,
} from "@/features/chat/utils/mute-rules";
import {
  adminActorKey,
  parseActorRef,
  userActorKey,
} from "@/features/contact-aliases/utils/alias-rules";

// Per-person notification mutes (see mute-rules). Keys are actor keys. Expired
// rows are never returned: they count as unmuted without any cleanup job.

export const setMute = async (
  ownerKey: string,
  targetKey: string,
  mutedUntil: Date | null,
) => {
  await db
    .insert(chatMutes)
    .values({ ownerKey, targetKey, mutedUntil })
    .onConflictDoUpdate({
      target: [chatMutes.ownerKey, chatMutes.targetKey],
      set: { mutedUntil },
    });
};

// Idempotent: clearing a mute that does not exist is fine.
export const clearMute = async (ownerKey: string, targetKey: string) => {
  await db
    .delete(chatMutes)
    .where(
      and(eq(chatMutes.ownerKey, ownerKey), eq(chatMutes.targetKey, targetKey)),
    );
};

// The owner's mutes still in force, by target key (value = end, null = no end).
export const listActiveMutes = async (
  ownerKey: string,
  now: Date,
): Promise<Map<string, Date | null>> => {
  const rows = await db
    .select({
      targetKey: chatMutes.targetKey,
      mutedUntil: chatMutes.mutedUntil,
    })
    .from(chatMutes)
    .where(eq(chatMutes.ownerKey, ownerKey));

  return new Map(
    rows
      .filter((row) => isMuteActive(row, now))
      .map((row) => [row.targetKey, row.mutedUntil]),
  );
};

// Of `ownerKeys`, those that muted `targetKey` right now (one query, for the
// push filters).
export const loadMutedOwnerKeys = async (
  targetKey: string,
  ownerKeys: readonly string[],
  now: Date,
): Promise<Set<string>> => {
  if (ownerKeys.length === 0) {
    return new Set();
  }
  const rows = await db
    .select({
      ownerKey: chatMutes.ownerKey,
      mutedUntil: chatMutes.mutedUntil,
    })
    .from(chatMutes)
    .where(
      and(
        eq(chatMutes.targetKey, targetKey),
        inArray(chatMutes.ownerKey, [...ownerKeys]),
      ),
    );

  return new Set(
    rows.filter((row) => isMuteActive(row, now)).map((row) => row.ownerKey),
  );
};

// Trainee ids this admin has muted right now.
export const listMutedUserIds = async (
  adminId: number,
  now: Date,
): Promise<Set<number>> => {
  const mutes = await listActiveMutes(adminActorKey(adminId), now);

  return new Set(
    [...mutes.keys()].flatMap((key) => {
      const ref = parseActorRef(key);

      return ref?.kind === "user" ? [ref.id] : [];
    }),
  );
};

// One chat's state for the page that renders its header or info.
export const getMuteState = async (
  adminId: number,
  userId: number,
  now: Date = new Date(),
): Promise<MuteState> => {
  const [row] = await db
    .select({ mutedUntil: chatMutes.mutedUntil })
    .from(chatMutes)
    .where(
      and(
        eq(chatMutes.ownerKey, adminActorKey(adminId)),
        eq(chatMutes.targetKey, userActorKey(userId)),
      ),
    );

  return toMuteState(row, now);
};
