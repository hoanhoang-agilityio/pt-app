import { type NextRequest, NextResponse } from "next/server";

import {
  groupJson,
  listApiGroupSessions,
  notFound,
  parseIdParam,
  type RouteParams,
  unauthorized,
} from "@/features/chat-groups/services/group-api";
import { findGroupPhotoForSession } from "@/features/chat-groups/services/group-photos";

// GET: the photo of a stored message, 404 for anyone who is not a member of
// that group (never 403, so ids reveal nothing). The group in the URL must be
// the photo's own group.
export const GET = async (
  _request: NextRequest,
  { params }: RouteParams<"groupId" | "photoId">,
) => {
  const sessions = await listApiGroupSessions();

  if (sessions.length === 0) {
    return unauthorized();
  }
  const { groupId: rawGroup, photoId: rawPhoto } = await params;
  const groupId = parseIdParam(rawGroup);
  const photoId = parseIdParam(rawPhoto);

  if (!groupId || !photoId) {
    return notFound();
  }
  for (const session of sessions) {
    const found = await findGroupPhotoForSession(photoId, session, groupId);

    if (found) {
      return new NextResponse(new Uint8Array(found.data), {
        status: 200,
        headers: {
          "Content-Type": found.mime,
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    }
  }
  return groupJson({ error: "not_found" }, 404);
};
