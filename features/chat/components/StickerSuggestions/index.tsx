"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { PickedSticker } from "@/features/chat/components/StickerPanel";
import {
  bundledStickerUrl,
  STICKER_PACK_ID,
} from "@/features/chat/constants/stickers";
import {
  addRecentSticker,
  loadRecentStickers,
  saveRecentStickers,
} from "@/features/chat/utils/recent-stickers";
import { matchStickerSuggestions } from "@/features/chat/utils/sticker-suggestions";

interface StickerSuggestionsProps {
  // What is typed in the composer.
  text: string;
  // Sends the sticker; the composer clears the text.
  onPick: (sticker: PickedSticker) => void;
  onDismiss: () => void;
}

const LOCAL_DEBOUNCE_MS = 120;
const TILE =
  "relative flex size-14 shrink-0 items-center justify-center rounded-xl p-1 transition active:scale-90 active:bg-line motion-reduce:transition-none motion-reduce:active:scale-100";

// The row above the chat input: bundled stickers that match what is being
// typed (after a short debounce). GIPHY suggestions are disabled for now to
// save function CPU; GIFs are still searchable in the sticker panel. Renders
// nothing when there is nothing to show.
export const StickerSuggestions = ({
  text,
  onPick,
  onDismiss,
}: StickerSuggestionsProps) => {
  const t = useTranslations("chat.stickerSuggest");
  const locale = useLocale();
  // Read once when the row first appears (it only mounts on the client).
  const [recent] = useState(loadRecentStickers);
  const [debouncedText, setDebouncedText] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(text), LOCAL_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text]);

  const recentIds = recent.flatMap((item) =>
    item.kind === "pack" ? [item.id] : [],
  );
  const local = matchStickerSuggestions(debouncedText, locale, recentIds);

  if (local.length === 0) {
    return null;
  }

  const send = (sticker: PickedSticker) => {
    const { input } = sticker;

    if (!("customId" in input)) {
      saveRecentStickers(
        addRecentSticker(
          loadRecentStickers(),
          "pack" in input
            ? { kind: "pack", pack: input.pack, id: input.id }
            : {
                kind: "giphy",
                giphyId: input.giphyId,
                url: input.url,
                alt: sticker.display.alt,
              },
        ),
      );
    }
    onPick(sticker);
  };

  return (
    <div className="mx-3 mb-1 rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 px-3 pt-1.5 text-xs text-muted">
        <span className="font-semibold">{t("title")}</span>
        <button
          type="button"
          tabIndex={-1}
          // Keep focus (and the keyboard) in the textarea.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onDismiss}
          className="min-h-8 px-1 font-semibold active:text-fg"
        >
          {t("hide")}
        </button>
      </div>
      <div
        role="group"
        aria-label={t("label")}
        className="flex items-center gap-1 overflow-x-auto overscroll-x-contain px-2 pt-0.5 pb-2"
      >
        {local.map((sticker) => {
          const url = bundledStickerUrl(STICKER_PACK_ID, sticker.id);

          return (
            <button
              key={sticker.id}
              type="button"
              aria-label={t("send", { alt: sticker.alt })}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                send({
                  input: { pack: STICKER_PACK_ID, id: sticker.id },
                  display: { kind: "pack", url, alt: sticker.alt },
                })
              }
              className={TILE}
            >
              <Image
                src={url}
                alt=""
                width={48}
                height={48}
                unoptimized
                draggable={false}
                className="size-full object-contain"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
