// Device tokens whose DELETE /v1/push/devices did not go through (offline or
// the session was already revoked). They are kept and retried on the next
// launch or sign-in, so a token never stays registered to the old account.

export const parsePendingTokens = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((t): t is string => typeof t === "string" && t.length > 0))]
      : [];
  } catch {
    return [];
  }
};

export const addPendingToken = (list: string[], token: string) =>
  list.includes(token) ? list : [...list, token];

export const removePendingToken = (list: string[], token: string) =>
  list.filter((t) => t !== token);

export const isPushPlatform = (os: string): os is "ios" | "android" =>
  os === "ios" || os === "android";
