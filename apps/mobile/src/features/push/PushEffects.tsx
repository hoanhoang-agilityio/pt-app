import * as Notifications from "expo-notifications";
import { type Href, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppState } from "react-native";

import { parseAppBadge } from "@/lib/badge";
import { createHandledTracker, routeForNotificationData } from "@/lib/push-routes";

import { useAuth } from "../auth/auth-context";
import { useUnread } from "../chat/hooks";
import { configureNotificationHandler, registerForPush, syncBadge, unregisterPush } from "./push";

configureNotificationHandler();

// Module level so a remount does not navigate to the same notification again.
const markHandled = createHandledTracker();

// Always mounted (also behind the admin passcode lock screen), so every
// sign-out path drops the push registration and the badge.
export const PushSignOutCleanup = () => {
  const { onBeforeSignOut } = useAuth();

  useEffect(
    () =>
      onBeforeSignOut(async ({ forced }) => {
        void syncBadge(0);
        await unregisterPush({ forced });
      }),
    [onBeforeSignOut],
  );

  return null;
};

// Mounted while signed in: registers the device once, and opens the right screen when a notification is tapped.
export const PushEffects = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const unread = useUnread();
  const badge = parseAppBadge(unread.data);
  const badgeRef = useRef<number | null>(null);
  const { refetch } = unread;

  // Badge follows the unread query, and is refreshed when the app comes back.
  useEffect(() => {
    badgeRef.current = badge;
    if (badge !== null) {
      void syncBadge(badge);
    }
  }, [badge, unread.dataUpdatedAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        if (badgeRef.current !== null) {
          void syncBadge(badgeRef.current);
        }
        void refetch();
      }
    });

    return () => subscription.remove();
  }, [refetch]);

  useEffect(() => {
    void registerForPush(t("push.channel"));
    // Register once per sign-in: the language of the channel name is cosmetic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (response && markHandled(response.notification.request.identifier)) {
        router.push(
          routeForNotificationData(response.notification.request.content.data) as string as Href,
        );
      }
      Notifications.clearLastNotificationResponse();
    };

    // The app was opened by tapping a notification.
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);

    return () => subscription.remove();
  }, [router]);

  return null;
};
