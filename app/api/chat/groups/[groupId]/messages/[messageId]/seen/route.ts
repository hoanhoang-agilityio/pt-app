import type { NextRequest } from "next/server";

import { loadGroupActor } from "@/features/chat-groups/services/group-access";
import {
  getApiGroupSession,
  groupJson,
  notFound,
  parseIdParam,
  type RouteParams,
  unauthorized,
} from "@/features/chat-groups/services/group-api";
import { listSeenBy } from "@/features/chat-groups/services/group-queries";

// Who read up to a message ("Seen by N" sheet), never the sender.
export const GET = async (
  request: NextRequest,
  { params }: RouteParams<"groupId" | "messageId">,
) => {
  const caller = await getApiGroupSession(request);

  if (!caller) {
    return unauthorized();
  }
  const { groupId: rawGroup, messageId: rawMessage } = await params;
  const groupId = parseIdParam(rawGroup);
  const messageId = parseIdParam(rawMessage);
  const context = groupId
    ? await loadGroupActor(groupId, caller.session)
    : null;
  const seenBy =
    context && messageId
      ? await listSeenBy(context.group.id, messageId, context.actor)
      : null;

  return seenBy ? groupJson({ seenBy }) : notFound();
};
