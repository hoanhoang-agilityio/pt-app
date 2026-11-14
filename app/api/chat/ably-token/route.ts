import { type NextRequest, NextResponse } from "next/server";

import { isChatEnabled } from "@/features/chat/services/chat-permission";
import { getOrCreateConversation } from "@/features/chat/services/chat-queries";
import {
  createChatTokenRequest,
  isRealtimeConfigured,
} from "@/features/chat/services/chat-realtime";
import {
  adminCapability,
  adminClientId,
  traineeCapability,
  traineeClientId,
} from "@/features/chat/utils/ably-capabilities";
import { loadGroupActor } from "@/features/chat-groups/services/group-access";
import { getApiGroupSession } from "@/features/chat-groups/services/group-api";
import { createGroupTokenRequest } from "@/features/chat-groups/services/group-realtime";
import { listDmConversationIds } from "@/features/social/services/dm-queries";
import {
  isSuperAdmin,
  listConversationIdsInScope,
} from "@/services/admin-scope";
import { getApiAdmin, getApiUser } from "@/services/auth-guard";
import { logServerError } from "@/services/logger";

const NO_STORE = { "Cache-Control": "no-store" };

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: NO_STORE });

// `?group=<id>`: a token for one open group after the membership check:
// subscribe on `chat:group:<id>` only, never a wildcard (not even for super
// admins). A missing or dissolved group, a non-member and a left member all
// get the same 404. A trainee whose chat is off still reads, so still gets it.
const groupToken = async (request: NextRequest) => {
  const caller = await getApiGroupSession(request);

  if (!caller) {
    return json({ error: "unauthorized" }, 401);
  }
  const context = await loadGroupActor(
    request.nextUrl.searchParams.get("group"),
    caller.session,
  );

  if (!context || context.group.dissolvedAt !== null) {
    return json({ error: "not_found" }, 404);
  }
  const tokenRequest = await createGroupTokenRequest(
    context.group.id,
    context.actor,
  );

  return tokenRequest
    ? NextResponse.json(tokenRequest, { headers: NO_STORE })
    : new NextResponse(null, { status: 204, headers: NO_STORE });
};

// Hands the browser a signed Ably token request (subscribe-only). The API key
// itself never leaves the server. 204 = no key configured, the client keeps
// polling. A browser may hold both an admin and a trainee cookie; the admin
// token is only issued when asked for with `?as=admin`, otherwise the trainee
// session wins.
export const GET = async (request: NextRequest) => {
  try {
    if (!isRealtimeConfigured()) {
      return new NextResponse(null, { status: 204, headers: NO_STORE });
    }
    if (request.nextUrl.searchParams.get("group") !== null) {
      return await groupToken(request);
    }
    if (request.nextUrl.searchParams.get("as") === "admin") {
      const admin = await getApiAdmin();

      if (!admin) {
        return json({ error: "unauthorized" }, 401);
      }
      const tokenRequest = await createChatTokenRequest({
        clientId: adminClientId(admin.id),
        capability: adminCapability(
          isSuperAdmin(admin)
            ? undefined
            : await listConversationIdsInScope(admin.id),
        ),
      });

      return tokenRequest
        ? NextResponse.json(tokenRequest, { headers: NO_STORE })
        : new NextResponse(null, { status: 204, headers: NO_STORE });
    }
    const user = await getApiUser();

    if (!user) {
      return json({ error: "unauthorized" }, 401);
    }
    if (!isChatEnabled(user)) {
      return json({ error: "chat_locked" }, 403);
    }
    const conversation = await getOrCreateConversation(user.id);
    const tokenRequest = await createChatTokenRequest({
      clientId: traineeClientId(user.id),
      capability: traineeCapability(
        user.id,
        conversation.id,
        await listDmConversationIds(user.id),
      ),
    });

    return tokenRequest
      ? NextResponse.json(tokenRequest, { headers: NO_STORE })
      : new NextResponse(null, { status: 204, headers: NO_STORE });
  } catch (error) {
    logServerError("chatAblyToken", error);
    return json({ error: "server_error" }, 500);
  }
};
