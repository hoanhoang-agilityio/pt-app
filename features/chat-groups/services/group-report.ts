import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { chatGroupMessages } from "@/db/schema";
import {
  loadGroupActor,
  sessionOfAdmin,
  sessionOfUser,
} from "@/features/chat-groups/services/group-access";
import { setGroupMessageHidden } from "@/features/chat-groups/services/group-mutations";
import { touchGroupMessage } from "@/features/chat-groups/services/group-queries";
import { publishGroupUpdate } from "@/features/chat-groups/services/group-realtime";
import { sessionKey } from "@/features/chat-groups/utils/group-rules";
import type { SocialActor } from "@/features/social/types/social";
import { toAdminRole } from "@/services/admin-scope";

// Reports about group messages (spec G15). The report service in
// features/social calls these two functions; everything about who may see a
// group stays behind loadGroupActor.

const findReportableRow = async (messageId: number) => {
  const [row] = await db
    .select()
    .from(chatGroupMessages)
    .where(eq(chatGroupMessages.id, messageId))
    .limit(1);

  return row ?? null;
};

const sessionOfActor = (actor: SocialActor) =>
  actor.kind === "user"
    ? sessionOfUser(actor)
    : sessionOfAdmin({ id: actor.id, role: toAdminRole(actor.role) });

// Any active member may report another member's message. Not your own, not a
// system line or an alert, not an unsent or hidden one (gone for the
// reporter), not one with a deleted sender, and a super admin never reports
// (they moderate). A non-member, a left member and a dissolved group all
// answer false, the same as an unknown id.
export const canReportGroupMessage = async (
  actor: SocialActor,
  messageId: number,
) => {
  if (actor.kind === "admin" && toAdminRole(actor.role) === "super_admin") {
    return false;
  }
  const message = await findReportableRow(messageId);

  if (
    !message ||
    message.kind !== "message" ||
    message.audience !== null ||
    message.senderKey === null ||
    message.deletedAt !== null ||
    message.hiddenAt !== null
  ) {
    return false;
  }
  const session = sessionOfActor(actor);

  if (message.senderKey === sessionKey(session)) {
    return false;
  }
  return (await loadGroupActor(message.groupId, session)) !== null;
};

// The "hide" resolution of a report: hides the message for everybody, like a
// manager's hide, even in a dissolved group (only super admins reach it).
// Already unsent, already hidden or gone counts as done.
export const hideReportedGroupMessage = async (
  adminId: number,
  messageId: number,
) => {
  const message = await findReportableRow(messageId);

  if (
    !message ||
    message.kind !== "message" ||
    message.deletedAt !== null ||
    message.hiddenAt !== null
  ) {
    return;
  }
  await setGroupMessageHidden(messageId, `admin:${adminId}`);
  await touchGroupMessage(message.groupId, messageId);
  await publishGroupUpdate(message.groupId, messageId);
};
