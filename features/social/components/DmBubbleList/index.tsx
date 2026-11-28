"use client";

import clsx from "clsx";
import { RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ChatPhotoGrid } from "@/features/chat/components/ChatPhotoGrid";
import { ChatPhotoImage } from "@/features/chat/components/ChatPhotoImage";
import { ChatPhotoViewer } from "@/features/chat/components/ChatPhotoViewer";
import { ReplyHoverButton } from "@/features/chat/components/ReplyHoverButton";
import { SwipeReplyRow } from "@/features/chat/components/SwipeReplyRow";
import { useBubbleGesture } from "@/features/chat/hooks/use-bubble-gesture";
import { quoteText, unsentText } from "@/features/chat/utils/chat-thread-rules";
import { PHOTO_ALT } from "@/features/chat/utils/photo-rules";
import { DmPostQuote } from "@/features/social/components/DmPostQuote";
import type { DmReplyToView } from "@/features/social/types/dm";
import type { DmThreadItem } from "@/features/social/utils/dm-thread-rules";
import { getFormatTranslator } from "@/i18n/format-translator";
import { type Locale, toIntlLocale } from "@/utils/locale";

// Loaded only for the super admin, so nobody else downloads the reveal code.
const RevealableUnsent = dynamic(() =>
  import("@/features/chat/components/RevealableUnsent").then(
    (module) => module.RevealableUnsent,
  ),
);

// The photos of one message: a single image, or a grid with a viewer.
const DmPhotos = ({
  photos,
  isDimmed,
}: {
  photos: { url: string; width: number; height: number }[];
  isDimmed: boolean;
}) => {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const shown = photos.map((photo) => ({ ...photo, alt: PHOTO_ALT }));

  if (shown.length === 1) {
    return <ChatPhotoImage photo={shown[0]} isDimmed={isDimmed} />;
  }
  return (
    <>
      <ChatPhotoGrid
        photos={shown}
        isDimmed={isDimmed}
        onOpen={setViewerIndex}
      />
      <ChatPhotoViewer
        photos={shown}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
};

interface DmBubbleListProps {
  items: DmThreadItem[];
  // The signed-in trainee; null for the read-only admin view.
  meId: number | null;
  // Admin view: sender names by id.
  names?: Map<number, string>;
  // The other member's name, for the quote of their message.
  otherName?: string;
  // The own message the other member has read last.
  seenId?: number | null;
  // Super admin view (decided on the server): unsent lines reveal on click.
  canRevealUnsent?: boolean;
  onUnsend?: (messageId: number) => void;
  onRetry?: (clientId: string) => void;
  // Quick reply (swipe right, hover button, R key); left out when nobody can
  // write (the admin view, a read-only chat).
  onReply?: (item: DmThreadItem) => void;
}

const HIGHLIGHT_MS = 1500;

interface DmBubbleRowProps {
  item: DmThreadItem;
  isMine: boolean;
  canRevealUnsent: boolean;
  isHighlighted: boolean;
  onReply?: () => void;
  onJumpToReply: (messageId: number) => void;
  // Who wrote the quoted message.
  authorOf: (senderId: number) => string;
}

// One bubble with its swipe / hover / R key reply. Only a stored, not unsent
// message can be replied to.
const DmBubbleRow = ({
  item,
  isMine,
  canRevealUnsent,
  isHighlighted,
  onReply,
  onJumpToReply,
  authorOf,
}: DmBubbleRowProps) => {
  const locale = useLocale();
  const t = useTranslations("chat.messageBubble");
  const unsentLabel = unsentText(locale);
  const canReply = onReply !== undefined && !item.pending && !item.deleted;
  const gesture = useBubbleGesture(canReply, {
    onReply: canReply ? onReply : undefined,
  });
  const { replyTo } = item;

  return (
    <SwipeReplyRow
      isSwipeable={canReply}
      className={clsx(
        "flex w-full items-end gap-1.5",
        isMine ? "justify-end" : "justify-start",
      )}
    >
      {isMine && canReply && (
        <ReplyHoverButton label={t("replyToMessage")} onClick={onReply} />
      )}
      <div
        {...gesture}
        tabIndex={canReply ? 0 : undefined}
        className={clsx(
          "max-w-[80%] space-y-1.5 rounded-2xl px-3 py-2 text-base break-words focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none",
          // pan-y alone: iOS Safari rejects the pinch-zoom keyword, which voids the
          // whole value (back to auto) and lets Safari steal the swipe. Sideways
          // moves reach the swipe, up and down still scroll.
          canReply && "touch-pan-y",
          isMine
            ? "bg-accent text-accent-fg"
            : "border border-line bg-surface text-fg",
          item.pending === "sending" && "opacity-70",
          isHighlighted && "ring-2 ring-accent",
        )}
      >
        {item.deleted ? (
          canRevealUnsent ? (
            <RevealableUnsent
              kind="dm"
              messageId={item.id}
              label={unsentLabel}
            />
          ) : (
            <p className="text-muted italic">{unsentLabel}</p>
          )
        ) : (
          <>
            {replyTo && (
              <button
                type="button"
                onClick={() => onJumpToReply(replyTo.id)}
                aria-label={t("viewReply")}
                className={clsx(
                  "block max-w-full border-l-2 py-0.5 pl-2 text-left text-xs",
                  isMine
                    ? "border-accent-fg/60 text-accent-fg/80"
                    : "border-accent text-muted",
                )}
              >
                <span className="block truncate font-semibold">
                  {authorOf(replyTo.senderId)}
                </span>
                <span
                  className={clsx(
                    "line-clamp-2 break-words",
                    replyTo.deleted && "italic",
                  )}
                >
                  {replyPreview(replyTo, locale)}
                </span>
              </button>
            )}
            {item.post && <DmPostQuote post={item.post} />}
            {item.photo && (
              <DmPhotos
                photos={
                  item.photos && item.photos.length > 0
                    ? item.photos
                    : [item.photo]
                }
                isDimmed={item.pending === "sending"}
              />
            )}
            {item.body && (
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {item.body}
              </p>
            )}
          </>
        )}
      </div>
      {!isMine && canReply && (
        <ReplyHoverButton label={t("replyToMessage")} onClick={onReply} />
      )}
    </SwipeReplyRow>
  );
};

const replyPreview = (replyTo: DmReplyToView, locale: Locale) =>
  quoteText(
    {
      deleted: replyTo.deleted,
      isPhoto: replyTo.photoCount > 0,
      photoCount: replyTo.photoCount,
      body: replyTo.body ?? "",
    },
    locale,
  );

const formatTime = (iso: string, locale: Locale) =>
  new Date(iso).toLocaleTimeString(toIntlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  });

// Plain bubbles in the chat colours: mine on the right in the accent colour,
// theirs on the left. An own message has a "Thu hồi" button (confirm-free: the
// message is only taken back, nothing else is lost).
export const DmBubbleList = ({
  items,
  meId,
  names,
  otherName,
  seenId = null,
  canRevealUnsent = false,
  onUnsend,
  onRetry,
  onReply,
}: DmBubbleListProps) => {
  const locale = useLocale();
  const t = useTranslations("social.dmBubbleList");
  const listRef = useRef<HTMLUListElement>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (highlightTimer.current !== null) {
        clearTimeout(highlightTimer.current);
      }
    },
    [],
  );

  const authorOf = (senderId: number) =>
    meId !== null && senderId === meId
      ? getFormatTranslator(locale)("thread.you")
      : (names?.get(senderId) ?? otherName ?? t("deleted"));

  // A tap on a quote: scroll to the original and flash it. An original that
  // is not loaded (older than the page) just does nothing.
  const jumpTo = (messageId: number) => {
    const node = listRef.current?.querySelector(
      `[data-dm-message-id="${messageId}"]`,
    );

    if (!node) {
      return;
    }
    node.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    setHighlightId(messageId);
    if (highlightTimer.current !== null) {
      clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = setTimeout(
      () => setHighlightId(null),
      HIGHLIGHT_MS,
    );
  };

  return (
    <ul ref={listRef} className="flex flex-col gap-2">
      {items.map((item) => {
        const isMine = meId !== null && item.senderId === meId;

        return (
          <li
            key={item.clientId}
            data-dm-message-id={item.pending ? undefined : item.id}
            className={clsx(
              "flex flex-col gap-0.5",
              isMine ? "items-end" : "items-start",
            )}
          >
            {names && (
              <span className="px-1 text-xs font-medium text-muted">
                {names.get(item.senderId) ?? t("deleted")}
              </span>
            )}
            <DmBubbleRow
              item={item}
              isMine={isMine}
              canRevealUnsent={canRevealUnsent}
              isHighlighted={highlightId === item.id}
              onReply={onReply ? () => onReply(item) : undefined}
              onJumpToReply={jumpTo}
              authorOf={authorOf}
            />
            <div className="flex items-center gap-2 px-1 text-xs text-muted">
              <time dateTime={item.createdAt}>
                {formatTime(item.createdAt, locale)}
              </time>
              {item.pending === "failed" && onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(item.clientId)}
                  className="inline-flex min-h-8 items-center gap-1 font-semibold text-danger"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  {t("retry")}
                </button>
              )}
              {isMine && !item.pending && seenId === item.id && (
                <span>{t("seen")}</span>
              )}
              {isMine && !item.pending && onUnsend && (
                <button
                  type="button"
                  onClick={() => onUnsend(item.id)}
                  className="inline-flex min-h-8 items-center font-semibold"
                >
                  {t("unsend")}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
