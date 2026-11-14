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
import { loadGroupEditHistory } from "@/features/chat-groups/services/group-queries";

// Previous bodies of a message, for every member of the group.
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
  const edits =
    context && messageId
      ? await loadGroupEditHistory(context.group.id, messageId, context.actor)
      : null;

  return edits ? groupJson({ edits }) : notFound();
};
