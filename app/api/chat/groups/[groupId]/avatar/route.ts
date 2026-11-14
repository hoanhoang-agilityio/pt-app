import { type NextRequest, NextResponse } from "next/server";

import { loadGroupActor } from "@/features/chat-groups/services/group-access";
import {
  listApiGroupSessions,
  notFound,
  parseIdParam,
  type RouteParams,
  unauthorized,
} from "@/features/chat-groups/services/group-api";
import { loadGroupAvatar } from "@/features/chat-groups/services/group-photos";

// GET: the group's photo for its members (404 for everyone else and for a
// group without a photo). The URL is versioned (?v=), so a private cache may
// keep the bytes.
export const GET = async (
  _request: NextRequest,
  { params }: RouteParams<"groupId">,
) => {
  const sessions = await listApiGroupSessions();

  if (sessions.length === 0) {
    return unauthorized();
  }
  const groupId = parseIdParam((await params).groupId);

  if (!groupId) {
    return notFound();
  }
  for (const session of sessions) {
    if (!(await loadGroupActor(groupId, session))) {
      continue;
    }
    const avatar = await loadGroupAvatar(groupId);

    return avatar
      ? new NextResponse(new Uint8Array(avatar.bytes), {
          status: 200,
          headers: {
            "Content-Type": avatar.mime,
            "Cache-Control": "private, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
          },
        })
      : notFound();
  }
  return notFound();
};
