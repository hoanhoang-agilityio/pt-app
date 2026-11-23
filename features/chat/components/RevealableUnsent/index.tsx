"use client";

import clsx from "clsx";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type {
  RevealedUnsent,
  UnsentKind,
} from "@/features/chat/services/unsent-reveal";
import { revealUnsentMessageAction } from "@/features/chat/services/unsent-reveal-actions";

interface RevealableUnsentProps {
  kind: UnsentKind;
  messageId: number;
  // The "message was unsent" line the super admin clicks.
  label: string;
}

// Super admin only (the caller renders it only for them, and loads this module
// lazily, so other viewers never download or call the action). The placeholder
// is swapped in place for the original: the first click fetches it, the next
// ones hide and show it from state without asking the server again.
export const RevealableUnsent = ({
  kind,
  messageId,
  label,
}: RevealableUnsentProps) => {
  const t = useTranslations("chat.messageBubble");
  const [content, setContent] = useState<RevealedUnsent | null>(null);
  const [isShown, setShown] = useState(false);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (isPending) {
      return;
    }
    if (isShown) {
      setShown(false);
      return;
    }
    if (content) {
      setShown(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await revealUnsentMessageAction(kind, messageId);

      if (result.status === "success") {
        setContent(result.content);
        setShown(true);
      } else {
        setError(result.message);
      }
    } catch {
      setError(t("revealFailed"));
    } finally {
      setPending(false);
    }
  };

  const showContent = isShown && content !== null;

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={isShown}
        aria-busy={isPending}
        disabled={isPending}
        className={clsx(
          "block w-full cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none",
          showContent
            ? "space-y-2 rounded-xl border border-dashed border-line bg-surface px-2.5 py-1.5 text-fg not-italic"
            : "italic",
          isPending && "opacity-50",
        )}
      >
        {showContent ? (
          <>
            {content.sticker && (
              <Image
                src={content.sticker.url}
                alt={content.sticker.alt}
                width={120}
                height={120}
                unoptimized
                draggable={false}
                className="size-30 object-contain"
              />
            )}
            {content.photos.map((photo, index) => (
              <Image
                key={index}
                src={photo.url}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                unoptimized
                draggable={false}
                className="h-auto max-w-full rounded-lg"
              />
            ))}
            {content.body !== "" && (
              <span className="block break-words whitespace-pre-wrap">
                {content.body}
              </span>
            )}
          </>
        ) : (
          label
        )}
      </button>
      {error && (
        <span
          role="alert"
          className="mt-1 block text-xs text-danger not-italic"
        >
          {error}
        </span>
      )}
    </>
  );
};
