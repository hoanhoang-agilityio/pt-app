import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sumAppBadge } from "@/features/app-badge/utils/app-badge-rules";
import { isChatEnabled } from "@/features/chat/services/chat-permission";
import {
  countUnreadForUser,
  findConversationByUserId,
  findLatestLoudIncomingForUser,
  listUnreadByTraineeForAdmin,
} from "@/features/chat/services/chat-queries";
import {
  beatAdmin,
  beatUser,
  peerPresenceForUser,
  peersForAdmin,
} from "@/features/chat/services/presence-beat";
import {
  sessionOfAdmin,
  sessionOfUser,
} from "@/features/chat-groups/services/group-access";
import { countGroupUnread } from "@/features/chat-groups/services/group-queries";
import { countDmUnread } from "@/features/social/services/dm-queries";
import { countUnreadNotifications } from "@/features/social/services/social-notifications";
import { getApiAdmin, getApiUser } from "@/services/auth-guard";
import { logServerError } from "@/services/logger";

const NO_STORE = { "Cache-Control": "no-store" };

// Optional peer presence riding on the badge poll. A bad value just means no
// peer fields: it never fails the badge.
const peerFlagSchema = z.literal("1");
// Only an open page asks for the heartbeat (`beat=1`). The service worker
// reads this route on every push with no page open: that must neither mark
// the person online nor slide the admin unlock.
const beatFlagSchema = z.literal("1");
// `peerUserIds=1,2`: up to 10 positive ids, deduped. Anything else: no peers.
const MAX_PEER_IDS = 10;
const peerUserIdsSchema = z
  .string()
  .transform((value) => value.split(",").map(Number))
  .pipe(z.array(z.number().int().positive()).min(1).max(MAX_PEER_IDS))
  .transform((ids) => [...new Set(ids)]);

// Beat and peer reads are extras: a failure is logged and the badge goes on.
const optional = <T>(name: string, work: Promise<T> | null) =>
  work === null
    ? Promise.resolve(null)
    : work.catch((error: unknown) => {
        logServerError(name, error);
        return null;
      });

const unauthorized = () =>
  NextResponse.json(
    { error: "unauthorized" },
    { status: 401, headers: NO_STORE },
  );

// Badge poll, which with `beat=1` also records the caller's presence heartbeat
// (the same one POST /api/presence writes), so one request every 30 s covers badge and
// presence. Optional peer: trainee `?peer=1` adds { peerLastSeenAt, serverNow }
// for the PT team; admin `?peerUserIds=1,2` adds serverNow and
// `peers: { [userId]: { peerLastSeenAt } }`, after the same access checks as
// /api/presence/peer (an inaccessible id is left out).
// Trainee: unread count plus what decides whether the tab shows
// at all. `?as=admin` (admin cookie only, a trainee session never gets it):
// the admin's unread total and the count per trainee. A browser may hold both
// cookies, so the admin view is only served when asked for.
export const GET = async (request: NextRequest) => {
  if (request.nextUrl.searchParams.get("as") === "admin") {
    const admin = await getApiAdmin();

    if (!admin) {
      return unauthorized();
    }
    const wantsBeat = beatFlagSchema.safeParse(
      request.nextUrl.searchParams.get("beat"),
    ).success;
    const peerUserIds = peerUserIdsSchema.safeParse(
      request.nextUrl.searchParams.get("peerUserIds"),
    );
    const [perTrainee, groups, notifications, peer] = await Promise.all([
      listUnreadByTraineeForAdmin(admin.id),
      countGroupUnread(sessionOfAdmin(admin)),
      countUnreadNotifications(`admin:${admin.id}`),
      optional(
        "unreadPeers",
        peerUserIds.success ? peersForAdmin(admin.id, peerUserIds.data) : null,
      ),
      optional("unreadBeatAdmin", wantsBeat ? beatAdmin(admin) : null),
    ]);
    const count = perTrainee.reduce((total, row) => total + row.unread, 0);

    return NextResponse.json(
      {
        count,
        perTrainee,
        groups,
        // Home-screen icon badge: chats + groups + social notifications.
        appBadge: sumAppBadge({
          chat: count,
          groups: groups.total,
          notifications,
        }),
        ...peer,
      },
      { headers: NO_STORE },
    );
  }
  const user = await getApiUser();

  if (!user) {
    return unauthorized();
  }
  const wantsBeat = beatFlagSchema.safeParse(
    request.nextUrl.searchParams.get("beat"),
  ).success;
  const [
    coachCount,
    conversation,
    dmCount,
    latestLoudIncomingId,
    groups,
    notifications,
    peer,
  ] = await Promise.all([
    countUnreadForUser(user.id),
    findConversationByUserId(user.id),
    countDmUnread(user.id),
    findLatestLoudIncomingForUser(user.id),
    countGroupUnread(sessionOfUser(user)),
    countUnreadNotifications(`user:${user.id}`),
    optional(
      "unreadPeer",
      peerFlagSchema.safeParse(request.nextUrl.searchParams.get("peer")).success
        ? peerPresenceForUser()
        : null,
    ),
    optional("unreadBeatUser", wantsBeat ? beatUser(user.id) : null),
  ]);
  // The Messages tab badge covers the coach chat and the friend chats.
  const count = coachCount + dmCount;

  return NextResponse.json(
    {
      count,
      coachCount,
      dmCount,
      chatEnabled: isChatEnabled(user),
      hasHistory: conversation?.lastMessageId != null,
      latestLoudIncomingId,
      // Group chats: reported next to the existing fields, which do not
      // change (the badge wiring comes with the trainee UI).
      groups,
      // Home-screen icon badge: chats + groups + social notifications.
      appBadge: sumAppBadge({
        chat: count,
        groups: groups.total,
        notifications,
      }),
      ...peer,
    },
    { headers: NO_STORE },
  );
};
