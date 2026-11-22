import { chatUnreadResponseSchema } from "@pt/contracts";
import { z } from "zod";

// The API's GET /v1/chat/unread may return `appBadge` (integer) for trainees
// and admins. Older API versions omit it, so it is optional. Parsed locally so
// the shared contract does not have to change with it.
export const unreadWithBadgeSchema = chatUnreadResponseSchema.and(
  z.object({ appBadge: z.number().int().min(0).optional() }),
);

export const parseAppBadge = (data: unknown): number | null => {
  const value =
    data && typeof data === "object"
      ? (data as { appBadge?: unknown }).appBadge
      : undefined;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.floor(value));
};
