"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { useInboxRealtimeConnected } from "@/features/chat/hooks/inbox-realtime";
import {
  getUnreadSnapshot,
  subscribeUnread,
  UNREAD_REFRESH_EVENT,
} from "@/features/chat/hooks/unread-store";
import {
  ADMIN_UNREAD_URL,
  USER_UNREAD_URL,
} from "@/features/chat/hooks/use-chat-unread";
import { unreadPollMs } from "@/features/chat/utils/polling-rules";
import {
  clockSkewMs,
  mergeLastSeen,
  parsePeerReading,
  peerUnreadQuery,
  type PresenceView,
  presenceView,
  serverClockNow,
} from "@/features/chat/utils/presence-status";
import { startVisibleInterval } from "@/utils/visible-interval";

const LABEL_TICK_MS = 30_000;

interface Options {
  role: "user" | "admin";
  userId: number;
  // The snapshot's reading, then whatever the message polls bring.
  fromThread: string | null | undefined;
}

// The other side's status for the thread header. Seeded from the thread,
// kept fresh by the message polls (via `fromThread`) and the peer fields of
// the shared unread poll (the message poll's 204 carries no presence). The
// label is recomputed every 30 s so "N phút trước" ticks (no request).
export const usePeerPresence = ({
  role,
  userId,
  fromThread,
}: Options): PresenceView | null => {
  const locale = useLocale();
  const [fetched, setFetched] = useState<Date | null>(null);
  // Device clock minus server clock, measured from the unread poll. Null
  // until the first answer (or its failure): without it a device clock that
  // runs behind would show an idle peer as online.
  const [skewMs, setSkewMs] = useState<number | null>(null);
  // Null until mounted: the server render and first client render agree.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());

    tick();
    // No label ticks while hidden; one tick when the tab returns.
    return startVisibleInterval(tick, LABEL_TICK_MS);
  }, []);

  // The peer's last seen rides on the shared unread poll (which also beats
  // this person's own presence), so there is no request of our own here. Only
  // a reading that arrives while mounted counts: an older one in the store has
  // a stale `serverNow`, which would skew the clock.
  const realtimeConnected = useInboxRealtimeConnected();
  const pollMs = unreadPollMs(role === "admin" && realtimeConnected);

  useEffect(() => {
    const url = role === "admin" ? ADMIN_UNREAD_URL : USER_UNREAD_URL;
    const onPayload = () => {
      const reading = parsePeerReading(
        getUnreadSnapshot(url),
        role === "admin" ? userId : undefined,
      );

      if (reading === null) {
        return;
      }
      if (reading.serverNow !== null) {
        setSkewMs(clockSkewMs(reading.serverNow, Date.now()));
      }
      if (reading.peerLastSeenAt !== null) {
        setFetched((current) => mergeLastSeen(current, reading.peerLastSeenAt));
      }
      // A payload without a server clock falls back to the device clock.
      setSkewMs((current) => current ?? 0);
      setNow(new Date());
    };
    const unsubscribe = subscribeUnread(
      url,
      pollMs,
      onPayload,
      peerUnreadQuery(role, userId),
    );

    // Ask for a fresh reading right away (a no-op while one is in flight).
    window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT));
    return unsubscribe;
  }, [role, userId, pollMs]);

  // No answer at all (offline, hidden, idle): fall back to the device clock
  // rather than showing nothing.
  useEffect(() => {
    const timer = setTimeout(
      () => setSkewMs((current) => current ?? 0),
      10_000,
    );

    return () => clearTimeout(timer);
  }, []);

  if (now === null || skewMs === null) {
    return null;
  }
  const lastSeenAt = mergeLastSeen(fetched, fromThread ?? undefined);

  return presenceView(
    lastSeenAt,
    serverClockNow(now.getTime(), skewMs),
    locale,
  );
};
