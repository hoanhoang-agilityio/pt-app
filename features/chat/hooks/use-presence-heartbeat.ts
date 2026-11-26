"use client";

import { useEffect } from "react";

import { useInboxRealtimeConnected } from "@/features/chat/hooks/inbox-realtime";
import { subscribeUnread } from "@/features/chat/hooks/unread-store";
import {
  ADMIN_UNREAD_URL,
  USER_UNREAD_URL,
} from "@/features/chat/hooks/use-chat-unread";
import { unreadPollMs } from "@/features/chat/utils/polling-rules";

// Tells the server this person has the app open (KAN-129). It no longer posts
// to /api/presence: every unread poll (GET /api/chat/unread) records the
// heartbeat, so this only keeps the shared poller alive for the whole session,
// including where the badge subscriber is paused (the trainee's /messages).
// The poll runs once on mount, every 30 s (60 s with a live admin inbox) while
// the tab is visible and the user active, and again on return. Errors are
// ignored: the next poll retries.
export const usePresenceHeartbeat = (role: "user" | "admin") => {
  const realtimeConnected = useInboxRealtimeConnected();
  const pollMs = unreadPollMs(role === "admin" && realtimeConnected);

  useEffect(
    () =>
      subscribeUnread(
        role === "admin" ? ADMIN_UNREAD_URL : USER_UNREAD_URL,
        pollMs,
        () => undefined,
      ),
    [role, pollMs],
  );
};
