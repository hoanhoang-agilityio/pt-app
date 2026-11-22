"use client";

import { EmojiPicker as Frimousse } from "frimousse";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { BottomSheet } from "@/components/common/BottomSheet";
import {
  addRecentReaction,
  isReactionEmoji,
  parseRecentReactions,
  RECENT_REACTIONS_KEY,
} from "@/utils/reaction-emoji";

interface EmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

// Locales with their own emoji data in public/emojibase (see
// scripts/copy-emojibase.mjs); any other locale reads the English data.
const DATA_LOCALES: readonly string[] = ["vi", "en", "zh"];
const EMOJIBASE_URL = "/emojibase";

const EMOJI_BUTTON =
  "flex size-10 items-center justify-center rounded-lg text-2xl transition active:scale-90 data-[active]:bg-line";

const readRecent = () => {
  try {
    return parseRecentReactions(localStorage.getItem(RECENT_REACTIONS_KEY));
  } catch {
    return [];
  }
};

const writeRecent = (recent: string[]) => {
  try {
    localStorage.setItem(RECENT_REACTIONS_KEY, JSON.stringify(recent));
  } catch {
    // Private mode or blocked storage: recents just are not remembered.
  }
};

const CategoryHeader: NonNullable<
  Parameters<typeof Frimousse.List>[0]["components"]
>["CategoryHeader"] = ({ category, ...props }) => (
  <div
    {...props}
    className="bg-bg px-1 pt-3 pb-1.5 text-xs font-semibold text-muted"
  >
    {category.label}
  </div>
);

const EmojiButton: NonNullable<
  Parameters<typeof Frimousse.List>[0]["components"]
>["Emoji"] = ({ emoji, ...props }) => (
  <button {...props} type="button" className={EMOJI_BUTTON}>
    {emoji.emoji}
  </button>
);

const Row: NonNullable<
  Parameters<typeof Frimousse.List>[0]["components"]
>["Row"] = (props) => <div {...props} className="flex scroll-my-1 px-1" />;

const PickerBody = ({
  onClose,
  onSelect,
}: Pick<EmojiPickerProps, "onClose" | "onSelect">) => {
  const t = useTranslations("common.emojiPicker");
  const locale = useLocale();
  // Mounted only while the sheet is open, so storage is read fresh each time.
  const [recent, setRecent] = useState(readRecent);

  const choose = (emoji: string) => {
    if (!isReactionEmoji(emoji)) {
      return;
    }
    const next = addRecentReaction(recent, emoji);

    setRecent(next);
    writeRecent(next);
    onSelect(emoji);
    onClose();
  };

  return (
    // vaul would read a drag inside the scrolling list as a swipe to close.
    <div data-vaul-no-drag className="flex h-[min(26rem,60dvh)] flex-col">
      {recent.length > 0 && (
        <section aria-label={t("recent")} className="mb-2">
          <h3 className="px-1 pb-1 text-xs font-semibold text-muted">
            {t("recent")}
          </h3>
          <div className="flex flex-wrap gap-0.5">
            {recent.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                onClick={() => choose(emoji)}
                className={EMOJI_BUTTON}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>
      )}
      <Frimousse.Root
        locale={DATA_LOCALES.includes(locale) ? locale : "en"}
        emojibaseUrl={EMOJIBASE_URL}
        columns={8}
        onEmojiSelect={({ emoji }) => choose(emoji)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-center gap-2">
          <Frimousse.Search
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base text-fg outline-none placeholder:text-muted focus:border-accent"
          />
          <Frimousse.SkinToneSelector
            aria-label={t("skinTone")}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-xl transition active:scale-90"
          />
        </div>
        <Frimousse.Viewport className="relative mt-1 min-h-0 flex-1 outline-none">
          <Frimousse.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            {t("loading")}
          </Frimousse.Loading>
          <Frimousse.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            {t("empty")}
          </Frimousse.Empty>
          <Frimousse.List
            className="select-none"
            components={{ CategoryHeader, Emoji: EmojiButton, Row }}
          />
        </Frimousse.Viewport>
      </Frimousse.Root>
    </div>
  );
};

// Full emoji picker in a bottom sheet: recent emoji, search, skin tone and the
// category list. Picking calls onSelect, then onClose.
export const EmojiPicker = ({ open, onClose, onSelect }: EmojiPickerProps) => {
  const t = useTranslations("common.emojiPicker");

  return (
    <BottomSheet
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      title={t("title")}
      // The search field must not pop the keyboard the moment the sheet opens.
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      <PickerBody onClose={onClose} onSelect={onSelect} />
    </BottomSheet>
  );
};
