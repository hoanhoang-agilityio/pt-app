"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EmojiPicker } from "@/components/EmojiPicker";
import { DEFAULT_REACTIONS } from "@/utils/reaction-emoji";

interface ReactionRowProps {
  // My current reaction, if any.
  mine: string | null;
  // null = remove my reaction (tapping my current one again).
  onPick: (emoji: string | null) => void;
  label: string;
}

const BUTTON =
  "flex size-9.5 shrink-0 items-center justify-center rounded-full text-2xl transition active:scale-90";

// The quick reactions, my own if it is not one of them, and a "+" that opens
// the full emoji picker. Eight buttons fit a 360px screen.
export const ReactionRow = ({ mine, onPick, label }: ReactionRowProps) => {
  const t = useTranslations("common.emojiPicker");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const isCustomMine =
    mine !== null && !(DEFAULT_REACTIONS as readonly string[]).includes(mine);
  const emojis: readonly string[] = isCustomMine
    ? [...DEFAULT_REACTIONS, mine]
    : DEFAULT_REACTIONS;

  return (
    <>
      <div
        role="group"
        aria-label={label}
        className="mb-2 flex justify-between rounded-2xl border border-line bg-surface p-1.5"
      >
        {emojis.map((emoji) => {
          const isMine = mine === emoji;

          return (
            <button
              key={emoji}
              type="button"
              aria-label={emoji}
              aria-pressed={isMine}
              onClick={() => onPick(isMine ? null : emoji)}
              className={clsx(
                BUTTON,
                isMine && "bg-accent/20 ring-2 ring-accent",
              )}
            >
              {emoji}
            </button>
          );
        })}
        <button
          type="button"
          aria-label={t("more")}
          onClick={() => setIsPickerOpen(true)}
          className={clsx(BUTTON, "bg-line text-fg")}
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
      <EmojiPicker
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(emoji) => onPick(emoji === mine ? null : emoji)}
      />
    </>
  );
};
