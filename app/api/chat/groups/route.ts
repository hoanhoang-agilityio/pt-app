import type { NextRequest } from "next/server";

import {
  getApiGroupSession,
  groupJson,
  unauthorized,
} from "@/features/chat-groups/services/group-api";
import { listGroupsForSession } from "@/features/chat-groups/services/group-queries";
import { logServerError } from "@/services/logger";

// The caller's group list (own memberships; a super admin sees every group
// that is not dissolved). The caller always comes from the session.
export const GET = async (request: NextRequest) => {
  const caller = await getApiGroupSession(request);

  if (!caller) {
    return unauthorized();
  }
  try {
    return groupJson({ groups: await listGroupsForSession(caller.session) });
  } catch (error) {
    logServerError("listChatGroups", error);
    return groupJson({ error: "server_error" }, 500);
  }
};
