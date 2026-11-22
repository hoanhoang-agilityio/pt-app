import * as Notifications from "expo-notifications";
import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { routeForNotificationData } from "@/lib/push-routes";

import { useAuth } from "../auth/auth-context";
import { configureNotificationHandler, registerForPush, unregisterPush } from "./push";

configureNotificationHandler();

// Mounted while signed in: registers the device once, drops the registration
// on logout, and opens the right screen when a notification is tapped.
export const PushEffects = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { onBeforeSignOut } = useAuth();

  useEffect(() => {
    void registerForPush(t("push.channel"));
    // Register once per sign-in: the language of the channel name is cosmetic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => onBeforeSignOut(unregisterPush), [onBeforeSignOut]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (response) {
        router.push(
          routeForNotificationData(response.notification.request.content.data) as string as Href,
        );
      }
    };

    // The app was opened by tapping a notification.
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);

    return () => subscription.remove();
  }, [router]);

  return null;
};
