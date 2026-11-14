import "server-only";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { chatGroupMembers, chatGroups, pushSubscriptions } from "@/db/schema";
import {
  deliverLocalized,
  getVapid,
  type PushSender,
  sendWithWebPush,
} from "@/features/chat/services/chat-push";
import { loadActorIdentities } from "@/features/chat-groups/services/group-names";
import { listSuperAdminIds } from "@/features/chat-groups/services/group-queries";
import { buildGroupPushPayload } from "@/features/chat-groups/utils/group-push-rules";
import { logServerError } from "@/services/logger";

export interface SendGroupPushInput {
  groupId: number;
  // The sender's member key: never notified about their own message.
  senderKey: string;
  // Message text for the preview; never logged.
  body?: string | null;
  sticker?: boolean;
  photo?: boolean;
}

// Owner keys to notify: every active explicit member and every super admin
// (implicit), minus the sender and anyone who muted the group. A member who
// left or was removed has no active row, so gets nothing.
export const listGroupPushRecipients = async (
  groupId: number,
  senderKey: string,
) => {
  const [explicit, muted, superIds] = await Promise.all([
    db
      .select({ memberKey: chatGroupMembers.memberKey })
      .from(chatGroupMembers)
      .where(
        and(
          eq(chatGroupMembers.groupId, groupId),
          isNull(chatGroupMembers.leftAt),
        ),
      ),
    db
      .select({ memberKey: chatGroupMembers.memberKey })
      .from(chatGroupMembers)
      .where(
        and(
          eq(chatGroupMembers.groupId, groupId),
          isNotNull(chatGroupMembers.mutedAt),
        ),
      ),
    listSuperAdminIds(),
  ]);
  const mutedKeys = new Set(muted.map((row) => row.memberKey));
  const keys = new Set([
    ...explicit.map((row) => row.memberKey),
    ...superIds.map((id) => `admin:${id}`),
  ]);

  keys.delete(senderKey);
  return [...keys].filter((key) => !mutedKeys.has(key)).sort();
};

// Never throws and never logs the body: only ids and counts. Two deliveries,
// one per owner kind, because the deep link differs.
export const sendGroupPush = async (
  { groupId, senderKey, body, sticker, photo }: SendGroupPushInput,
  sender: PushSender = sendWithWebPush,
) => {
  try {
    const vapid = getVapid();

    if (!vapid) {
      return;
    }
    const [group] = await db
      .select({ name: chatGroups.name, dissolvedAt: chatGroups.dissolvedAt })
      .from(chatGroups)
      .where(eq(chatGroups.id, groupId))
      .limit(1);

    if (!group || group.dissolvedAt !== null) {
      return;
    }
    const keys = await listGroupPushRecipients(groupId, senderKey);

    if (keys.length === 0) {
      return;
    }
    const [subscriptions, identities] = await Promise.all([
      db
        .select()
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.ownerKey, keys)),
      loadActorIdentities([senderKey]),
    ]);
    const senderName = identities.get(senderKey)?.name ?? "";

    await Promise.all(
      (["user", "admin"] as const).map((recipient) => {
        const targets = subscriptions.filter((target) =>
          target.ownerKey.startsWith(`${recipient}:`),
        );

        return targets.length === 0
          ? undefined
          : deliverLocalized(
              targets,
              (locale) =>
                buildGroupPushPayload({
                  recipient,
                  groupId,
                  groupName: group.name,
                  senderName,
                  body,
                  sticker,
                  photo,
                  locale,
                }),
              vapid,
              sender,
            );
      }),
    );
  } catch (error) {
    logServerError("sendGroupPush", error, { groupId });
  }
};

// Called after a NEW, non-silent message was stored. Runs after the response
// inside a request (Next's after()), otherwise fire-and-forget.
export const scheduleGroupPush = (input: SendGroupPushInput) => {
  try {
    after(() => sendGroupPush(input));
  } catch {
    void sendGroupPush(input);
  }
};
