// Pure rules for the home-screen icon badge (Badging API).

const asCount = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;

// What the badge counts: chat unread (coach + friend chats for a trainee,
// trainee chats for an admin), group chat unread and unread social
// notifications. Anything that is not a positive finite number counts as 0.
export const sumAppBadge = ({
  chat,
  groups,
  notifications,
}: {
  chat: number;
  groups: number;
  notifications: number;
}) => asCount(chat) + asCount(groups) + asCount(notifications);

// Reads `appBadge` from the `/api/chat/unread` JSON. null while there is no
// payload yet (or an older server without the field): the caller leaves the
// badge as it is.
export const parseAppBadge = (data: unknown): number | null => {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const value = (data as Record<string, unknown>).appBadge;

  return typeof value === "number" && Number.isFinite(value)
    ? asCount(value)
    : null;
};

export type AppBadgeAction =
  { kind: "set"; count: number } | { kind: "clear" } | { kind: "none" };

// The badge shows only while the Badging API exists, notifications are
// allowed and this browser holds a push subscription (the "Thông báo đẩy"
// toggle is on). Otherwise it is cleared. A count of 0 clears it too.
export const appBadgeAction = ({
  supported,
  permissionGranted,
  subscribed,
  count,
}: {
  supported: boolean;
  permissionGranted: boolean;
  subscribed: boolean;
  count: number | null;
}): AppBadgeAction => {
  if (!supported) {
    return { kind: "none" };
  }
  if (!permissionGranted || !subscribed) {
    return { kind: "clear" };
  }
  if (count === null) {
    return { kind: "none" };
  }
  return count > 0 ? { kind: "set", count } : { kind: "clear" };
};
