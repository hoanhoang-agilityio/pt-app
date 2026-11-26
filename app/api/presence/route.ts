import { type NextRequest, NextResponse } from "next/server";

import { beatAdmin, beatUser } from "@/features/chat/services/presence-beat";
import { getApiAdmin, getApiUser } from "@/services/auth-guard";

const NO_STORE = { "Cache-Control": "no-store" };

// Presence heartbeat (KAN-128). Pages no longer call this on a timer: the
// unread poll (GET /api/chat/unread) records the same heartbeat. Kept for
// other callers; the service writes at most once a minute per person.
// `?as=admin` uses the admin session, otherwise the trainee's. 204 on
// success, 401 when not signed in.
export const POST = async (request: NextRequest) => {
  if (request.nextUrl.searchParams.get("as") === "admin") {
    const admin = await getApiAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: NO_STORE },
      );
    }
    await beatAdmin(admin);
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  }
  const user = await getApiUser();

  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
  await beatUser(user.id);
  return new NextResponse(null, { status: 204, headers: NO_STORE });
};
