import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { db } from "@/db";
import {
  chatGroupMembers,
  chatGroupPhotos,
  chatGroupReactions,
} from "@/db/schema";

type Executor = Pick<typeof db, "delete">;

// Foreign keys are not enforced (D10), so deleting an account removes the
// child rows by hand. Messages stay: a deleted account shows as "Deleted
// member". Call inside the delete transaction.

// A trainee: member rows, reactions and uploads that never became a message.
export const removeUserFromGroups = async (
  executor: Executor,
  userId: number,
) => {
  const key = `user:${userId}`;

  await removeKeyFromGroups(executor, key);
};

// A PT (or any admin): member and state rows, reactions and pending uploads.
// Groups they created keep a dangling created_by_key on purpose: only super
// admins manage them afterwards.
export const removeAdminFromGroups = async (
  executor: Executor,
  adminId: number,
) => {
  await removeKeyFromGroups(executor, `admin:${adminId}`);
};

const removeKeyFromGroups = async (executor: Executor, key: string) => {
  await executor
    .delete(chatGroupMembers)
    .where(eq(chatGroupMembers.memberKey, key));
  await executor
    .delete(chatGroupReactions)
    .where(eq(chatGroupReactions.reactorKey, key));
  await executor
    .delete(chatGroupPhotos)
    .where(
      and(
        eq(chatGroupPhotos.uploaderKey, key),
        isNull(chatGroupPhotos.messageId),
      ),
    );
};
