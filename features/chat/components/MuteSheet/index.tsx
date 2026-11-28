"use client";

import clsx from "clsx";
import { BellOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { BottomSheet } from "@/components/common/BottomSheet";
import { Spinner } from "@/components/common/Spinner";
import { useMuteActions } from "@/features/chat/hooks/use-mute-actions";
import {
  formatMuteUntil,
  type MuteDuration,
  type MuteState,
} from "@/features/chat/utils/mute-rules";

interface MuteSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userId: number;
  // The shown name of the trainee, for the sheet's description.
  name: string;
  state: MuteState;
  onChanged?: (state: MuteState) => void;
}

const OPTIONS = [
  { duration: "1h", key: "hour1" },
  { duration: "4h", key: "hour4" },
  { duration: "8h", key: "hour8" },
  { duration: "tomorrow8", key: "untilMorning" },
  { duration: "forever", key: "forever" },
] as const satisfies readonly { duration: MuteDuration; key: string }[];

const OPTION =
  "flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-base font-medium text-fg transition active:bg-line disabled:opacity-50";

// "Tắt thông báo" sheet: the five durations and, while muted, a button to turn
// notifications back on. Closes itself once a choice is saved.
export const MuteSheet = ({
  isOpen,
  onOpenChange,
  userId,
  name,
  state,
  onChanged,
}: MuteSheetProps) => {
  const t = useTranslations("chat.mute");
  const locale = useLocale();
  const { mute, unmute, isPending } = useMuteActions(userId, (next) => {
    onChanged?.(next);
    onOpenChange(false);
  });
  const current = state.muted
    ? state.until
      ? t("currentUntil", {
          time: formatMuteUntil(new Date(state.until), new Date(), locale),
        })
      : t("currentForever")
    : null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={name}
    >
      <div className="space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-muted">{t("subtitle")}</p>
        {current && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm font-semibold text-fg"
          >
            <BellOff className="size-4 shrink-0" aria-hidden />
            {current}
          </p>
        )}
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {OPTIONS.map((option) => (
            <li key={option.duration}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => mute(option.duration)}
                className={OPTION}
              >
                {t(option.key)}
              </button>
            </li>
          ))}
        </ul>
        {state.muted && (
          <button
            type="button"
            disabled={isPending}
            aria-busy={isPending}
            onClick={unmute}
            className={clsx(
              OPTION,
              "justify-center rounded-2xl border border-line font-semibold text-accent",
            )}
          >
            {isPending && <Spinner size="sm" />}
            {t("unmute")}
          </button>
        )}
      </div>
    </BottomSheet>
  );
};
