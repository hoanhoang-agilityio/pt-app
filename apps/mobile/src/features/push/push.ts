import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/lib/api";
import { EAS_PROJECT_ID } from "@/lib/config";
import {
  addPendingToken,
  isPushPlatform,
  removePendingToken,
} from "@/lib/push-pending";
import {
  readPendingPushTokens,
  readPushToken,
  writePendingPushTokens,
  writePushToken,
} from "@/lib/token-store";

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

const deleteDevice = (token: string) =>
  api.delete("/v1/push/devices", { body: { token } });

// Retry the DELETEs that failed earlier (offline, revoked session). The token
// that is about to be registered again is skipped: the server upsert already
// moves it to the signed-in user, and a DELETE would remove that new row.
const flushPending = async (skip?: string) => {
  const pending = await readPendingPushTokens();
  let left = pending;

  for (const token of pending) {
    if (token === skip) {
      left = removePendingToken(left, token);
      continue;
    }
    try {
      await deleteDevice(token);
      left = removePendingToken(left, token);
    } catch {
      // Still failing: keep it for the next launch or sign-in.
    }
  }
  await writePendingPushTokens(left);
};

export const registerForPush = async (channelName: string) => {
  const projectId = EAS_PROJECT_ID;

  if (!isPushPlatform(Platform.OS)) {
    return null;
  }
  try {
    await flushPending();
  } catch {
    // Best effort.
  }
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

    // Every sign-in registers again: the server upsert moves the token to the
    // signed-in account.
    await api.post("/v1/push/devices", {
      body: { token, platform: Platform.OS },
    });
    await writePushToken(token);
    await writePendingPushTokens(
      removePendingToken(await readPendingPushTokens(), token),
    );
    return token;
  } catch {
    return null;
  }
};

// `forced`: the session is already revoked (401 / authRevoked), so the DELETE
// cannot succeed; the token is queued and retried after the next sign-in.
export const unregisterPush = async ({ forced = false } = {}) => {
  const token = await readPushToken();

  if (!token) {
    return;
  }
  await writePushToken(null);
  if (!forced) {
    try {
      await deleteDevice(token);
      return;
    } catch {
      // Offline: fall through and remember it.
    }
  }
  await writePendingPushTokens(
    addPendingToken(await readPendingPushTokens(), token),
  );
};

export const syncBadge = async (count: number) => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Badges are cosmetic (and unsupported on some launchers).
  }
};
