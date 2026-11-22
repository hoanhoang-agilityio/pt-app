"use client";

import { useCallback, useEffect, useState } from "react";

import { APP_BADGE_SUBSCRIPTION_EVENT } from "@/features/app-badge/constants/app-badge";
import {
  clearAppBadgeSafe,
  isAppBadgeSupported,
  setAppBadgeSafe,
} from "@/features/app-badge/utils/app-badge-client";
import {
  appBadgeAction,
  parseAppBadge,
} from "@/features/app-badge/utils/app-badge-rules";
import { useInboxRealtimeConnected } from "@/features/chat/hooks/inbox-realtime";
import {
  UNREAD_REFRESH_EVENT,
  useUnreadPayload,
} from "@/features/chat/hooks/unread-store";
import {
  ADMIN_UNREAD_URL,
  USER_UNREAD_URL,
} from "@/features/chat/hooks/use-chat-unread";
import { unreadPollMs } from "@/features/chat/utils/polling-rules";

const hasPushSubscription = async () => {
  try {
    if (!("serviceWorker" in navigator)) {
      return false;
    }
    const registration = await navigator.serviceWorker.ready;

    return (await registration.pushManager.getSubscription()) !== null;
  } catch {
    return false;
  }
};

// Mirrors the unread count onto the installed app's home-screen icon. It
// reads the shared unread poller (same URL and cadence as useChatUnread, so no
// extra requests) and only shows a number while notifications are on: the
// Notification permission is granted AND this browser holds a push
// subscription. Turning "Thông báo đẩy" off removes the subscription, which
// clears the badge here. The poller is never paused (unlike the tab-bar
// badge on /messages), so a trainee whose chat is disabled still gets the
// social-notification part of the count.
export const AppIconBadge = ({ role }: { role: "user" | "admin" }) => {
  const realtimeConnected = useInboxRealtimeConnected();
  const payload = useUnreadPayload(
    role === "admin" ? ADMIN_UNREAD_URL : USER_UNREAD_URL,
    true,
    unreadPollMs(role === "admin" && realtimeConnected),
  );
  const [subscribed, setSubscribed] = useState(false);
  const count = parseAppBadge(payload);

  const recheck = useCallback(async () => {
    setSubscribed(await hasPushSubscription());
  }, []);

  useEffect(() => {
    const onChange = () => {
      void recheck();
      // Fetch the count right away after the toggle.
      window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT));
    };

    // The subscription lives in the browser, so it is read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recheck();
    window.addEventListener(APP_BADGE_SUBSCRIPTION_EVENT, onChange);
    window.addEventListener("focus", recheck);
    return () => {
      window.removeEventListener(APP_BADGE_SUBSCRIPTION_EVENT, onChange);
      window.removeEventListener("focus", recheck);
    };
  }, [recheck]);

  useEffect(() => {
    const action = appBadgeAction({
      supported: isAppBadgeSupported(),
      permissionGranted:
        "Notification" in window && Notification.permission === "granted",
      subscribed,
      count,
    });

    if (action.kind === "set") {
      void setAppBadgeSafe(action.count);
    } else if (action.kind === "clear") {
      void clearAppBadgeSafe();
    }
  }, [subscribed, count]);

  return null;
};
