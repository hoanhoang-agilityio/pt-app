"use client";

import { useTranslations } from "next-intl";

import { BottomSheet } from "@/components/common/BottomSheet";
import { ReactionRow } from "@/components/ReactionRow";

interface ReactionPickerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  mine: string | null;
  // null = remove my reaction.
  onPick: (emoji: string | null) => void;
}

// The reaction row in a sheet (same row as the chat message sheet); picking my
// current one removes it.
export const ReactionPicker = ({
  isOpen,
  onOpenChange,
  mine,
  onPick,
}: ReactionPickerProps) => {
  const t = useTranslations("social.reactionPicker");

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
    >
      <ReactionRow
        mine={mine}
        label={t("title")}
        onPick={(emoji) => {
          onOpenChange(false);
          onPick(emoji);
        }}
      />
    </BottomSheet>
  );
};
