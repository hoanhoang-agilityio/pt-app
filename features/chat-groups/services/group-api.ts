import "server-only";

import { type NextRequest, NextResponse } from "next/server";

import { GROUP_API_ERRORS } from "@/features/chat-groups/constants/messages";
import {
  sessionOfAdmin,
  sessionOfUser,
} from "@/features/chat-groups/services/group-access";
import type { GroupSession } from "@/features/chat-groups/types/group";
import { parseGroupId } from "@/features/chat-groups/utils/group-rules";
import { getApiAdmin, getApiUser } from "@/services/auth-guard";

const NO_STORE = { "Cache-Control": "no-store" };

export const groupJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE });

export const unauthorized = () =>
  groupJson({ error: GROUP_API_ERRORS.UNAUTHORIZED }, 401);

// Every failure of the group routes that must not reveal whether a group
// exists: a missing group, a dissolved one, a non-member and a left member.
export const notFound = () =>
  groupJson({ error: GROUP_API_ERRORS.NOT_FOUND }, 404);

export interface ApiGroupSession {
  session: GroupSession;
  // The signed-in trainee (null for admins): chat switch and restrictions.
  user: { id: number; chatEnabled: boolean | null } | null;
}

// A browser may hold both an admin and a trainee cookie, so the admin view is
// only served when asked for with `?as=admin`; otherwise the trainee session
// wins. Null = no usable session (answer 401).
export const getApiGroupSession = async (
  request: NextRequest,
): Promise<ApiGroupSession | null> => {
  if (request.nextUrl.searchParams.get("as") === "admin") {
    const admin = await getApiAdmin();

    return admin ? { session: sessionOfAdmin(admin), user: null } : null;
  }
  const user = await getApiUser();

  return user
    ? {
        session: sessionOfUser(user),
        user: { id: user.id, chatEnabled: user.chatEnabled },
      }
    : null;
};

// For images: an <img> carries both cookies and no query, so every session the
// browser holds is tried, admin first.
export const listApiGroupSessions = async (): Promise<GroupSession[]> => {
  const [admin, user] = await Promise.all([getApiAdmin(), getApiUser()]);

  return [
    ...(admin ? [sessionOfAdmin(admin)] : []),
    ...(user ? [sessionOfUser(user)] : []),
  ];
};

// A cookie-authenticated write must come from this site.
export const isSameOrigin = (request: NextRequest) => {
  const origin = request.headers.get("origin");

  return origin === null || origin === request.nextUrl.origin;
};

export type RouteParams<T extends string> = {
  params: Promise<Record<T, string>>;
};

// A positive integer path segment, or null (answer 404, never 400, so ids
// reveal nothing).
export const parseIdParam = (value: string) => parseGroupId(value);
