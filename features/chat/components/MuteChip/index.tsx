"use client";

import { BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { MuteSheet } from "@/features/chat/components/MuteSheet";
import type { MuteState } from "@/features/chat/utils/mute-rules";

interface MuteChipProps {
  userId: number;
  name: string;
  initial: MuteState;
}

// Admin chat header: a small "Đã tắt thông báo" chip while this trainee is
// muted; a tap opens the mute sheet (to change the time or turn it back on).
export const MuteChip = ({ userId, name, initial }: MuteChipProps) => {
  const t = useTranslations("chat.mute");
  const [state, setState] = useState(initial);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {state.muted && (
        <div className="flex justify-center px-4 py-1.5">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-line px-3 text-xs font-semibold text-muted transition active:scale-95"
          >
            <BellOff className="size-3.5" aria-hidden />
            {t("label")}
          </button>
        </div>
      )}
      <MuteSheet
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        userId={userId}
        name={name}
        state={state}
        onChanged={setState}
      />
    </>
  );
};
