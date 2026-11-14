import { ROUTES } from "@/constants/routes";
import type { ChatPushPayload } from "@/features/chat/utils/push-rules";
import { buildPushPreview } from "@/features/chat/utils/push-rules";
import { DEFAULT_LOCALE, type Locale } from "@/utils/locale";

// Where a push opens: trainees and admins have their own routes.
export const groupPushUrl = (recipient: "user" | "admin", groupId: number) =>
  recipient === "user"
    ? `${ROUTES.MESSAGES}/groups/${groupId}`
    : `${ROUTES.ADMIN_MESSAGES}/groups/${groupId}`;

// One notification per group: the push tag, also what an open group thread
// clears (see clear-notifications.ts).
export const groupPushTag = (groupId: number) => `chat-group-${groupId}`;

// Title = the group, body = "<sender>: <preview>" in the recipient's
// language. One notification per group: a newer one replaces the older. The
// text only goes into the payload; it is never logged.
export const buildGroupPushPayload = ({
  recipient,
  groupId,
  groupName,
  senderName,
  body,
  sticker = false,
  photo = false,
  locale = DEFAULT_LOCALE,
}: {
  recipient: "user" | "admin";
  groupId: number;
  groupName: string;
  senderName: string;
  body?: string | null;
  sticker?: boolean;
  photo?: boolean;
  locale?: Locale;
}): ChatPushPayload => {
  const preview = buildPushPreview({ body, sticker, photo, locale });

  return {
    title: groupName,
    body: senderName.trim() === "" ? preview : `${senderName}: ${preview}`,
    url: groupPushUrl(recipient, groupId),
    tag: groupPushTag(groupId),
  };
};
