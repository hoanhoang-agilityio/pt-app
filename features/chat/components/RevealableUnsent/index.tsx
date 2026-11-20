"use client";

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
// becomes a toggle: the first click fetches the original, the next ones hide
// and show it from state without asking the server again.
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

  return (
    <>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={isShown}
        aria-busy={isPending}
        disabled={isPending}
        className="block w-full cursor-pointer text-left italic focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
      >
        {label}
        <span className="block text-[11px] not-italic underline underline-offset-2 opacity-70">
          {isPending
            ? t("revealing")
            : isShown
              ? t("hideHint")
              : t("revealHint")}
        </span>
      </button>
      {error && (
        <span
          role="alert"
          className="mt-1 block text-xs text-danger not-italic"
        >
          {error}
        </span>
      )}
      {isShown && content && (
        <div className="mt-2 space-y-2 border-t border-line pt-2 text-fg not-italic">
          {content.sticker && (
            <Image
              src={content.sticker.url}
              alt={content.sticker.alt}
              width={120}
              height={120}
              unoptimized
              draggable={false}
              className="size-[120px] object-contain"
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
          {content.body !== "" && <span>{content.body}</span>}
        </div>
      )}
    </>
  );
};
