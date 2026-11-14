import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { admins, chatGroupMembers, users } from "@/db/schema";
import type { GroupContext } from "@/features/chat-groups/services/group-access";
import { countExplicitMembers } from "@/features/chat-groups/services/group-queries";
import {
  publishGroupMembers,
  publishGroupMessage,
} from "@/features/chat-groups/services/group-realtime";
import { appendSystemLine } from "@/features/chat-groups/services/group-system-lines";
import {
  type AddMemberOutcome,
  addScopeOutcome,
  memberCapRoom,
} from "@/features/chat-groups/utils/group-rules";
import { toAdminRole } from "@/services/admin-scope";
import { canAdminAccessUser } from "@/services/hidden-users";

export interface AddMemberResult {
  kind: "user" | "admin";
  // The id as sent (anything the client put in the list).
  id: unknown;
  outcome: AddMemberOutcome;
}

const isId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

// G1, G3, G7, G9: adds trainees (and, for a super admin, PTs) to the group.
// Every id is judged on its own: unknown, out-of-scope, duplicate and
// over-the-cap ids are skipped with a result, never a crash. The count and the
// inserts run in one transaction, so two adds cannot both take the last place.
// A re-added member keeps the row (left_at cleared, joined_at reset, read
// cursor kept); a new one starts with nothing unread (full history stays
// readable, G8). The caller has checked canManage.
export const addMembersToGroup = async (
  { group, actor }: GroupContext,
  input: { userIds: unknown[]; ptIds: unknown[] },
) => {
  const seen = new Set<string>();
  const candidates = [
    ...input.userIds.map((id) => ({ kind: "user" as const, id })),
    ...input.ptIds.map((id) => ({ kind: "admin" as const, id })),
  ].filter((candidate) => {
    const token = `${candidate.kind}:${String(candidate.id)}`;

    if (seen.has(token)) {
      return false;
    }
    seen.add(token);
    return true;
  });
  const userIds = candidates.flatMap((c) =>
    c.kind === "user" && isId(c.id) ? [c.id] : [],
  );
  const adminIds = candidates.flatMap((c) =>
    c.kind === "admin" && isId(c.id) ? [c.id] : [],
  );
  const [userRows, adminRows] = await Promise.all([
    userIds.length
      ? db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, userIds))
      : [],
    adminIds.length
      ? db
          .select({ id: admins.id, role: admins.role })
          .from(admins)
          .where(inArray(admins.id, adminIds))
      : [],
  ]);
  const existingUsers = new Set(userRows.map((row) => row.id));
  const adminRoles = new Map(
    adminRows.map((row) => [row.id, toAdminRole(row.role)]),
  );
  // A PT may add only trainees they can open (own, not hidden); a super
  // admin needs no check.
  const accessible = new Map<number, boolean>();

  if (!actor.isSuperAdmin && actor.kind === "admin") {
    for (const id of existingUsers) {
      accessible.set(id, await canAdminAccessUser(actor.id, id));
    }
  }
  const now = new Date();
  const results: AddMemberResult[] = [];
  const added: string[] = [];
  let lineId = 0;

  await db.transaction(async (tx) => {
    let active = await countExplicitMembers(group.id, tx);

    for (const candidate of candidates) {
      const { kind, id } = candidate;
      const done = (outcome: AddMemberOutcome) =>
        results.push({ kind, id, outcome });

      if (!isId(id)) {
        done("invalid");
        continue;
      }
      if (kind === "user" ? !existingUsers.has(id) : !adminRoles.has(id)) {
        done("not_found");
        continue;
      }
      const refused = addScopeOutcome(
        actor,
        kind === "user"
          ? { kind, accessible: accessible.get(id) ?? false }
          : { kind, isPt: adminRoles.get(id) === "pt" },
      );

      if (refused) {
        done(refused);
        continue;
      }
      const memberKey = `${kind}:${id}`;
      const [row] = await tx
        .select()
        .from(chatGroupMembers)
        .where(
          and(
            eq(chatGroupMembers.groupId, group.id),
            eq(chatGroupMembers.memberKey, memberKey),
          ),
        );

      if (row && row.leftAt === null) {
        done("already_member");
        continue;
      }
      if (memberCapRoom(active) < 1) {
        done("cap_reached");
        continue;
      }
      if (row) {
        await tx
          .update(chatGroupMembers)
          .set({
            leftAt: null,
            removedByKey: null,
            addedByKey: actor.key,
            joinedAt: now,
          })
          .where(
            and(
              eq(chatGroupMembers.groupId, group.id),
              eq(chatGroupMembers.memberKey, memberKey),
            ),
          );
      } else {
        await tx.insert(chatGroupMembers).values({
          groupId: group.id,
          memberKey,
          addedByKey: actor.key,
          joinedAt: now,
          lastReadMessageId: group.lastMessageId ?? 0,
        });
      }
      active += 1;
      added.push(memberKey);
      done("added");
    }
    if (added.length > 0) {
      lineId = await appendSystemLine(
        group.id,
        { type: "member_added", actorKey: actor.key, memberKeys: added },
        { executor: tx, now },
      );
    }
  });
  if (added.length > 0) {
    await publishGroupMembers(group.id);
    await publishGroupMessage(group.id, lineId);
  }
  return {
    results,
    added,
    capReached: results.some((r) => r.outcome === "cap_reached"),
  };
};

// Sets left_at on an active row with one guarded update; false when the
// person is not an active member (a second call is a no-op). `byKey` null =
// the member left on their own.
export const deactivateMember = async (
  groupId: number,
  memberKey: string,
  byKey: string | null,
) => {
  const rows = await db
    .update(chatGroupMembers)
    .set({ leftAt: new Date(), removedByKey: byKey })
    .where(
      and(
        eq(chatGroupMembers.groupId, groupId),
        eq(chatGroupMembers.memberKey, memberKey),
        isNull(chatGroupMembers.leftAt),
      ),
    )
    .returning({ memberKey: chatGroupMembers.memberKey });

  return rows.length > 0;
};

// Removal by a manager: the guarded update plus the normal "removed" line.
export const removeMemberFromGroup = async (
  groupId: number,
  memberKey: string,
  actorKey: string,
) => {
  if (!(await deactivateMember(groupId, memberKey, actorKey))) {
    return false;
  }
  const lineId = await appendSystemLine(groupId, {
    type: "member_removed",
    actorKey,
    memberKey,
  });

  await publishGroupMembers(groupId);
  await publishGroupMessage(groupId, lineId);
  return true;
};

// A member leaves on their own.
export const leaveGroup = async (groupId: number, memberKey: string) => {
  if (!(await deactivateMember(groupId, memberKey, null))) {
    return false;
  }
  const lineId = await appendSystemLine(groupId, {
    type: "member_left",
    memberKey,
  });

  await publishGroupMembers(groupId);
  await publishGroupMessage(groupId, lineId);
  return true;
};
