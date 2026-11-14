"use server";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { chatGroupMessages, chatGroups } from "@/db/schema";
import { GROUP_MESSAGES } from "@/features/chat-groups/constants/messages";
import { findGroupById } from "@/features/chat-groups/services/group-access";
import { removeMemberFromGroup } from "@/features/chat-groups/services/group-membership";
import { loadActorIdentities } from "@/features/chat-groups/services/group-names";
import { bumpGroupChange } from "@/features/chat-groups/services/group-queries";
import {
  publishGroupMembers,
  publishGroupUpdate,
} from "@/features/chat-groups/services/group-realtime";
import {
  groupIdSchema,
  resolveAlertSchema,
} from "@/features/chat-groups/utils/group-rules";
import {
  parseSystemEvent,
  serializeSystemEvent,
} from "@/features/chat-groups/utils/system-event";
import { withResultErrorHandling } from "@/services/action-errors";
import { requireSuperAdmin } from "@/services/auth-guard";

// Super admin only: dissolving a group and resolving the PT-change alert.

const fail = (message: string) => ({ status: "error" as const, message });

// Soft dissolve: the data stays, the group leaves every list and sending and
// token minting stop. A second call is a no-op.
export const dissolveGroupAction = withResultErrorHandling(
  "dissolveGroup",
  async (input: unknown) => {
    const admin = await requireSuperAdmin();
    const parsed = groupIdSchema.safeParse(input);

    if (!parsed.success) {
      return fail(GROUP_MESSAGES.INVALID_INPUT);
    }
    const group = await findGroupById(parsed.data.groupId);

    if (!group) {
      return fail(GROUP_MESSAGES.GROUP_NOT_FOUND);
    }
    await db
      .update(chatGroups)
      .set({ dissolvedAt: new Date(), dissolvedByAdminId: admin.id })
      .where(and(eq(chatGroups.id, group.id), isNull(chatGroups.dissolvedAt)));
    await publishGroupMembers(group.id);
    return { status: "success" as const };
  },
);

// "Keep" or "Remove from group" on a PT-change alert. One guarded update (a
// compare-and-swap on the stored event, so it only applies while the alert is
// unresolved); a second tap or a second super admin gets "already handled by
// <name>". "Remove" also removes the trainee, with the normal "removed" line.
export const resolvePtChangeAlertAction = withResultErrorHandling(
  "resolvePtChangeAlert",
  async (input: unknown) => {
    const admin = await requireSuperAdmin();
    const parsed = resolveAlertSchema.safeParse(input);

    if (!parsed.success) {
      return fail(GROUP_MESSAGES.INVALID_INPUT);
    }
    const { groupId, messageId, choice } = parsed.data;
    const group = await findGroupById(groupId);
    const [row] = group
      ? await db
          .select({
            id: chatGroupMessages.id,
            systemEvent: chatGroupMessages.systemEvent,
            audience: chatGroupMessages.audience,
          })
          .from(chatGroupMessages)
          .where(
            and(
              eq(chatGroupMessages.id, messageId),
              eq(chatGroupMessages.groupId, groupId),
              eq(chatGroupMessages.kind, "system"),
            ),
          )
      : [];
    const event = row ? parseSystemEvent(row.systemEvent) : null;

    if (!group || !row || row.audience !== "super_admin") {
      return fail(GROUP_MESSAGES.ALERT_NOT_FOUND);
    }
    if (event?.type !== "pt_changed") {
      return fail(GROUP_MESSAGES.ALERT_NOT_FOUND);
    }
    const handled = async () => {
      const [fresh] = await db
        .select({ systemEvent: chatGroupMessages.systemEvent })
        .from(chatGroupMessages)
        .where(eq(chatGroupMessages.id, messageId));
      const resolved = parseSystemEvent(fresh?.systemEvent ?? null);
      const byKey =
        resolved?.type === "pt_changed" && resolved.resolution?.byAdminId
          ? `admin:${resolved.resolution.byAdminId}`
          : null;
      const names = byKey ? await loadActorIdentities([byKey]) : null;

      return {
        ...fail(GROUP_MESSAGES.ALERT_HANDLED),
        handledBy: (byKey && names?.get(byKey)?.name) || null,
      };
    };

    if (event.resolution !== null) {
      return handled();
    }
    const updated = await db
      .update(chatGroupMessages)
      .set({
        systemEvent: serializeSystemEvent({
          ...event,
          resolution: {
            choice,
            byAdminId: admin.id,
            at: Date.now(),
          },
        }),
      })
      .where(
        and(
          eq(chatGroupMessages.id, messageId),
          // Compare-and-swap: only while the stored text is still the
          // unresolved event we read.
          eq(chatGroupMessages.systemEvent, row.systemEvent!),
        ),
      )
      .returning({ id: chatGroupMessages.id });

    if (updated.length === 0) {
      return handled();
    }
    await db
      .update(chatGroupMessages)
      .set({ updatedAt: await bumpGroupChange(groupId) })
      .where(eq(chatGroupMessages.id, messageId));
    if (choice === "remove") {
      await removeMemberFromGroup(
        groupId,
        `user:${event.userId}`,
        `admin:${admin.id}`,
      );
    }
    await publishGroupUpdate(groupId, messageId);
    return { status: "success" as const };
  },
);
