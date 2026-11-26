import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  peerPresenceForAdmin,
  peerPresenceForUser,
} from "@/features/chat/services/presence-beat";
import { getApiAdmin, getApiUser } from "@/services/auth-guard";

const NO_STORE = { "Cache-Control": "no-store" };

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

const userIdSchema = z.coerce.number().int().positive();

// The other side's last heartbeat as an ISO string (or null), so the thread
// header can refresh its status every minute even when no message changed.
// `serverNow` lets the client measure its clock skew: last-seen is stamped
// by the server, so "online" must be judged on the server's clock.
// Trainee: newest last-seen across all PTs. `?as=admin&userId=N`: that
// trainee's last-seen; 404 when the user does not exist. The unread poll
// (GET /api/chat/unread) returns the same fields when asked for a peer.
export const GET = async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;

  if (params.get("as") === "admin") {
    const admin = await getApiAdmin();

    if (!admin) {
      return reply({ error: "unauthorized" }, 401);
    }
    const userId = userIdSchema.safeParse(params.get("userId"));

    if (!userId.success) {
      return reply({ error: "invalid_query" }, 400);
    }
    const peer = await peerPresenceForAdmin(admin.id, userId.data);

    return peer ? reply(peer) : reply({ error: "not_found" }, 404);
  }
  const user = await getApiUser();

  if (!user) {
    return reply({ error: "unauthorized" }, 401);
  }
  return reply(await peerPresenceForUser());
};
