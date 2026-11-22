import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/lib/api";
import { EAS_PROJECT_ID } from "@/lib/config";
import { readPushToken, writePushToken } from "@/lib/token-store";

// Expo push registration: ask permission, get the Expo push token, tell the
// API (POST /v1/push/devices) and forget it on logout (DELETE). Every step is
// best effort: a missing EAS project id, a denied permission or an API that is
// not deployed yet never breaks sign-in.

export const configureNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
};

export const registerForPush = async (channelName: string) => {
  const projectId = EAS_PROJECT_ID;

  if (!projectId) {
    return null;
  }
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: channelName,
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();

    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") {
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await api.post("/v1/push/devices", {
      body: { token, platform: Platform.OS },
    });
    await writePushToken(token);
    return token;
  } catch {
    return null;
  }
};

export const unregisterPush = async () => {
  const token = await readPushToken();

  if (!token) {
    return;
  }
  try {
    await api.delete("/v1/push/devices", { body: { token } });
  } finally {
    await writePushToken(null);
  }
};
