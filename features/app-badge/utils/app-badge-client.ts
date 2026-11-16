import { APP_BADGE_SUBSCRIPTION_EVENT } from "@/features/app-badge/constants/app-badge";

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export const isAppBadgeSupported = () =>
  typeof navigator !== "undefined" &&
  "setAppBadge" in navigator &&
  "clearAppBadge" in navigator;

// The Badging calls can reject (no permission, unsupported context), so they
// never throw to the caller.
export const setAppBadgeSafe = async (count: number) => {
  try {
    await (navigator as BadgeNavigator).setAppBadge?.(count);
  } catch {
    // Badge is a nicety.
  }
};

export const clearAppBadgeSafe = async () => {
  try {
    await (navigator as BadgeNavigator).clearAppBadge?.();
  } catch {
    // Badge is a nicety.
  }
};

export const notifyPushSubscriptionChange = () => {
  window.dispatchEvent(new Event(APP_BADGE_SUBSCRIPTION_EVENT));
};
