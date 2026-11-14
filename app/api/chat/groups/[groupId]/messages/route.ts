import type { NextRequest } from "next/server";

import {
  parseChangedSince,
  parseHistoryQuery,
} from "@/features/chat/utils/chat-query";
import { GROUP_API_ERRORS } from "@/features/chat-groups/constants/messages";
import { loadGroupActor } from "@/features/chat-groups/services/group-access";
import {
  getApiGroupSession,
  groupJson,
  notFound,
  parseIdParam,
  type RouteParams,
  unauthorized,
} from "@/features/chat-groups/services/group-api";
import { loadGroupThread } from "@/features/chat-groups/services/group-queries";

// One page of a group's thread (`before` / `after`) plus the messages changed
// since `changedSince`. Membership is checked on every request: a missing or
// dissolved group, a non-member and a left member all get 404.
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
  const search = request.nextUrl.searchParams;
  const query = parseHistoryQuery(search);

  if (!query.success) {
    return groupJson({ error: GROUP_API_ERRORS.INVALID_QUERY }, 400);
  }
  return groupJson(
    await loadGroupThread(
      context.group,
      context.actor,
      query.data,
      parseChangedSince(search.get("changedSince")),
    ),
  );
};
