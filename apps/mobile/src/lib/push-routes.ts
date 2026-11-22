// Where a tapped push notification opens. The API's push payload carries a web
// path in `url` (`{ title, body, url, tag }`); this maps it to an app route.
// Anything unknown opens the messages tab rather than failing.

export type AppRoute =
  | "/(tabs)"
  | "/(tabs)/messages"
  | "/notifications"
  | "/chat/coach"
  | `/chat/trainee/${number}`
  | `/chat/group/${number}`
  | `/chat/dm/${number}`
  | `/post/${number}`;

const ID = "([1-9]\\d{0,8})";

const RULES: { pattern: RegExp; to: (id: number) => AppRoute }[] = [
  { pattern: new RegExp(`^/messages/coach/?$`), to: () => "/chat/coach" },
  {
    pattern: new RegExp(`^/admin/users/${ID}/messages/?$`),
    to: (id) => `/chat/trainee/${id}`,
  },
  {
    pattern: new RegExp(`^(?:/admin)?/messages/groups/${ID}/?$`),
    to: (id) => `/chat/group/${id}`,
  },
  { pattern: new RegExp(`^/messages/dm/${ID}/?$`), to: (id) => `/chat/dm/${id}` },
  { pattern: new RegExp(`^(?:/admin)?/post/${ID}/?$`), to: (id) => `/post/${id}` },
];

export const routeForPushUrl = (url: unknown): AppRoute => {
  if (typeof url !== "string") {
    return "/(tabs)/messages";
  }
  // Only the path matters: drop the host, query and fragment.
  const path = url.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0];

  for (const rule of RULES) {
    const match = rule.pattern.exec(path);

    if (match) {
      return rule.to(match[1] === undefined ? 0 : Number(match[1]));
    }
  }
  if (path.startsWith("/notifications")) {
    return "/notifications";
  }
  return "/(tabs)/messages";
};

// The notification's `data` (Expo push `data`, or the web payload fields).
export const routeForNotificationData = (data: unknown): AppRoute => {
  const url =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>).url
      : undefined;

  return routeForPushUrl(url);
};
