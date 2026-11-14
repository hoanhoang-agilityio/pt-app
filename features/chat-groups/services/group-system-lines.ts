import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { chatGroupMembers, chatGroupMessages, chatGroups } from "@/db/schema";
import { publishGroupMessage } from "@/features/chat-groups/services/group-realtime";
import {
  parseSystemEvent,
  type PtChangeEvent,
  serializeSystemEvent,
  type SystemEvent,
} from "@/features/chat-groups/utils/system-event";
import { logServerError } from "@/services/logger";

type Executor = Pick<typeof db, "insert" | "update" | "select">;

// Stores a system line. A line for everyone moves the inbox pointer
// (last_message_*); an alert (`audience`) never does, so it cannot change the
// preview or the order of anybody who may not read it. Returns the row id.
export const appendSystemLine = async (
  groupId: number,
  event: SystemEvent,
  {
    audience = null,
    executor = db,
    now = new Date(),
  }: {
    audience?: "super_admin" | null;
    executor?: Executor;
    now?: Date;
  } = {},
) => {
  const [row] = await executor
    .insert(chatGroupMessages)
    .values({
      groupId,
      kind: "system",
      senderKey: null,
      body: "",
      systemEvent: serializeSystemEvent(event),
      audience,
      clientId: null,
      createdAt: now,
    })
    .returning({ id: chatGroupMessages.id });

  if (audience === null) {
    await executor
      .update(chatGroups)
      .set({ lastMessageId: row.id, lastMessageAt: now })
      .where(
        and(
          eq(chatGroups.id, groupId),
          sql`coalesce(${chatGroups.lastMessageId}, 0) < ${row.id}`,
        ),
      );
  }
  return row.id;
};

// A trainee's PT really changed (the caller already ruled out a re-save of
// the same value): one super-admin-only alert in every active group that has
// the trainee, superseding an older unresolved alert for the same trainee and
// group. Returns how many alerts were written.
export const recordPtChangeInGroups = async (
  userId: number,
  fromPtId: number | null,
  toPtId: number | null,
) => {
  if (fromPtId === toPtId) {
    return 0;
  }
  const groups = await db
    .select({ groupId: chatGroupMembers.groupId })
    .from(chatGroupMembers)
    .innerJoin(chatGroups, eq(chatGroups.id, chatGroupMembers.groupId))
    .where(
      and(
        eq(chatGroupMembers.memberKey, `user:${userId}`),
        isNull(chatGroupMembers.leftAt),
        isNull(chatGroups.dissolvedAt),
      ),
    );
  const alert: PtChangeEvent = {
    type: "pt_changed",
    userId,
    fromPtId,
    toPtId,
    resolution: null,
  };
  let written = 0;

  for (const { groupId } of groups) {
    try {
      const now = new Date();
      const id = await db.transaction(async (tx) => {
        const older = await tx
          .select({
            id: chatGroupMessages.id,
            systemEvent: chatGroupMessages.systemEvent,
          })
          .from(chatGroupMessages)
          .where(
            and(
              eq(chatGroupMessages.groupId, groupId),
              eq(chatGroupMessages.kind, "system"),
              eq(chatGroupMessages.audience, "super_admin"),
            ),
          );

        for (const row of older) {
          const event = parseSystemEvent(row.systemEvent);

          if (
            event?.type === "pt_changed" &&
            event.userId === userId &&
            event.resolution === null
          ) {
            // Compare-and-swap on the stored text: a super admin resolving it
            // at the same moment wins and the line stays theirs.
            await tx
              .update(chatGroupMessages)
              .set({
                systemEvent: serializeSystemEvent({
                  ...event,
                  resolution: {
                    choice: "superseded",
                    byAdminId: null,
                    at: now.getTime(),
                  },
                }),
              })
              .where(
                and(
                  eq(chatGroupMessages.id, row.id),
                  eq(chatGroupMessages.systemEvent, row.systemEvent!),
                ),
              );
          }
        }
        return appendSystemLine(groupId, alert, {
          audience: "super_admin",
          executor: tx,
          now,
        });
      });

      written += 1;
      await publishGroupMessage(groupId, id);
    } catch (error) {
      // One broken group must not stop the others (or the assignment).
      logServerError("recordPtChangeInGroups", error, { groupId, userId });
    }
  }
  return written;
};
