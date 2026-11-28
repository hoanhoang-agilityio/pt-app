import clsx from "clsx";
import { BellOff, Lock, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/common/Avatar";
import { Spinner } from "@/components/common/Spinner";
import { CARD } from "@/constants/styles";
import type { InboxItem } from "@/features/chat/services/chat-queries";
import {
  formatInboxTime,
  inboxPreviewPrefix,
} from "@/features/chat/utils/chat-inbox";
import { isOnline } from "@/features/chat/utils/presence";
import { shortLastSeen } from "@/features/chat/utils/presence-status";
import { BubbleRowTrigger } from "@/features/chat-bubbles/components/BubbleRowTrigger";
import { bubbleKeyFor } from "@/features/chat-bubbles/utils/bubble-links";
import { getAdminMessagesPath } from "@/utils/routes";

interface ChatInboxListProps {
  items: InboxItem[];
  adminId: number;
  nowMs: number;
  // "Chọn" mode: rows become checkboxes, selected by trainee id (KAN-164).
  isSelecting?: boolean;
  selectedIds?: ReadonlySet<number>;
  onToggle?: (userId: number) => void;
  // Revealed hidden trainees: a "Bỏ ẩn" button on each row.
  onUnhide?: (userId: number) => void;
  isBusy?: boolean;
  // A "⋯" button on each row opens the mute sheet for that trainee.
  onMuteMenu?: (item: InboxItem) => void;
}

const MAX_SHOWN = 99;

// One row per conversation: initials avatar, name, "who: preview", relative
// time; bold with a count when there is unread, a lock when chat is off.
export const ChatInboxList = ({
  items,
  adminId,
  nowMs,
  isSelecting = false,
  selectedIds,
  onToggle,
  onUnhide,
  isBusy = false,
  onMuteMenu,
}: ChatInboxListProps) => {
  const locale = useLocale();
  const t = useTranslations("chat.chatInbox");
  const tMute = useTranslations("chat.mute");
  // The row whose unhide is running (shows the spinner).
  const [tappedId, setTappedId] = useState<number | null>(null);

  return (
    <ul className={`${CARD} divide-y divide-line overflow-hidden`}>
      {items.map((item) => {
        const isUnread = item.unread > 0;
        const prefix = inboxPreviewPrefix(item, adminId, locale);
        const preview = item.preview
          ? `${prefix}${item.preview}`
          : t("noMessages");
        const time = formatInboxTime(
          item.lastMessageAt ? item.lastMessageAt.getTime() : null,
          nowMs,
          locale,
        );

        const now = new Date(nowMs);
        const online = isOnline(item.lastSeenAt, now);
        const lastSeen = shortLastSeen(item.lastSeenAt, now, locale);

        const row = (
          <>
            {isSelecting && (
              <input
                type="checkbox"
                checked={selectedIds?.has(item.userId) ?? false}
                onChange={() => onToggle?.(item.userId)}
                aria-label={t("selectRow", { name: item.displayName })}
                className="size-5 shrink-0 accent-accent"
              />
            )}
            <span className="relative shrink-0">
              <Avatar
                name={item.displayName}
                src={item.avatarUrl}
                tone="soft"
                className="size-11 text-sm"
              />
              {online && (
                <span
                  role="img"
                  aria-label={t("online")}
                  className="absolute right-0 bottom-0 size-3 rounded-full bg-success ring-2 ring-surface"
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className={clsx(
                    "flex min-w-0 items-center gap-1.5 text-fg",
                    isUnread ? "font-bold" : "font-semibold",
                  )}
                >
                  <span className="truncate">{item.displayName}</span>
                  {lastSeen && (
                    <span className="shrink-0 text-xs font-normal text-muted">
                      {lastSeen}
                    </span>
                  )}
                  {!item.chatEnabled && (
                    <Lock
                      className="size-3.5 shrink-0 text-muted"
                      aria-label={t("locked")}
                    />
                  )}
                </span>
                <span
                  className={clsx(
                    "shrink-0 text-xs",
                    isUnread && !item.muted
                      ? "font-semibold text-accent"
                      : "text-muted",
                  )}
                >
                  {time}
                </span>
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span
                  className={clsx(
                    "truncate text-sm",
                    isUnread ? "font-semibold text-fg" : "text-muted",
                  )}
                >
                  {preview}
                </span>
                {isUnread && (
                  <span
                    role="status"
                    aria-label={
                      item.muted
                        ? tMute("unreadMuted", { count: item.unread })
                        : t("unread", { count: item.unread })
                    }
                    className={clsx(
                      "inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 text-[11px] leading-none font-bold",
                      item.muted
                        ? "bg-line text-muted"
                        : "bg-accent text-accent-fg",
                    )}
                  >
                    {item.muted && <BellOff className="size-3" aria-hidden />}
                    {item.unread > MAX_SHOWN ? `${MAX_SHOWN}+` : item.unread}
                  </span>
                )}
                {!isUnread && item.muted && (
                  <BellOff
                    className="size-4 shrink-0 text-muted"
                    aria-label={tMute("label")}
                  />
                )}
              </span>
            </span>
          </>
        );
        const rowClass =
          "flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 transition active:bg-line";

        return (
          <li key={item.conversationId} className="flex items-center">
            {isSelecting ? (
              <label className={clsx(rowClass, "cursor-pointer")}>{row}</label>
            ) : (
              <BubbleRowTrigger
                role="admin"
                bubbleKey={bubbleKeyFor("admin", item.userId)}
                name={item.displayName}
                disabled={!item.chatEnabled}
              >
                <Link
                  href={getAdminMessagesPath(item.userId)}
                  className={rowClass}
                >
                  {row}
                </Link>
              </BubbleRowTrigger>
            )}
            {onMuteMenu && !isSelecting && (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={tMute("rowMenu", { name: item.displayName })}
                onClick={() => onMuteMenu(item)}
                className="mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition active:bg-line"
              >
                <MoreHorizontal className="size-5" aria-hidden />
              </button>
            )}
            {onUnhide && !isSelecting && (
              <button
                type="button"
                disabled={isBusy}
                aria-busy={isBusy && tappedId === item.userId}
                onClick={() => {
                  setTappedId(item.userId);
                  onUnhide(item.userId);
                }}
                className="mr-3 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-fg transition active:bg-line disabled:opacity-50"
              >
                {isBusy && tappedId === item.userId && <Spinner size="sm" />}
                {t("unhide")}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};
