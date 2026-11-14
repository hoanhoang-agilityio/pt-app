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
import { listGroupMembers } from "@/features/chat-groups/services/group-queries";

// Members with their Manager / PT / trainee label, super admins included.
export const GET = async (
  request: NextRequest,
  { params }: RouteParams<"groupId">,
) => {
  const caller = await getApiGroupSession(request);

  if (!caller) {
    return unauthorized();
  }
  const groupId = parseIdParam((await params).groupId);
  const context = groupId
    ? await loadGroupActor(groupId, caller.session)
    : null;

  if (!context) {
    return notFound();
  }
  return groupJson({
    members: await listGroupMembers(context.group, context.actor),
    canManage: context.actor.canManage,
    managersOnly: context.group.managersOnly === true,
  });
};
