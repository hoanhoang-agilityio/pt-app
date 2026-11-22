// The API's GET /v1/chat/unread returns `appBadge` (integer) for trainees and
// admins. Older API versions omit it, so it is optional here.

export const parseAppBadge = (data: unknown): number | null => {
  const value =
    data && typeof data === "object" ? (data as { appBadge?: unknown }).appBadge : undefined;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.floor(value));
};
