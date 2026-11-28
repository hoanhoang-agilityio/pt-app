"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { UNREAD_REFRESH_EVENT } from "@/features/chat/hooks/use-chat-unread";
import {
  muteContactAction,
  unmuteContactAction,
} from "@/features/chat/services/chat-mute-actions";
import {
  formatMuteUntil,
  type MuteDuration,
  type MuteState,
  UNMUTED,
} from "@/features/chat/utils/mute-rules";
import { describeErrorReference } from "@/utils/errors";

// Mute / unmute one trainee's chat for the signed-in admin. Reports the new
// state to the caller, toasts the outcome, and nudges the unread poll and the
// server-rendered lists so the badge and the rows catch up at once.
export const useMuteActions = (
  userId: number,
  onChanged?: (state: MuteState) => void,
) => {
  const t = useTranslations("chat.mute");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const finish = (state: MuteState, message: string) => {
    toast.success(message);
    onChanged?.(state);
    window.dispatchEvent(new Event(UNREAD_REFRESH_EVENT));
    router.refresh();
  };

  // The server's message plus, for an unexpected error, its reference id.
  const failed = (result: { message?: string; reference?: string }) => {
    toast.error(result.message ?? t("failed"), {
      description: describeErrorReference(result.reference),
    });
  };

  const mute = (duration: MuteDuration) =>
    startTransition(async () => {
      try {
        const result = await muteContactAction({
          userId,
          duration,
          // Lets the server compute "08:00 tomorrow" in this browser's zone.
          tzOffsetMinutes: new Date().getTimezoneOffset(),
        });

        if (result.status !== "success") {
          failed(result);
          return;
        }
        const until = result.until ? new Date(result.until) : null;

        finish(
          { muted: true, until: result.until ?? null },
          until
            ? t("mutedUntil", {
                time: formatMuteUntil(until, new Date(), locale),
              })
            : t("mutedForever"),
        );
      } catch {
        toast.error(t("failed"));
      }
    });

  const unmute = () =>
    startTransition(async () => {
      try {
        const result = await unmuteContactAction({ userId });

        if (result.status !== "success") {
          failed(result);
          return;
        }
        finish(UNMUTED, t("unmuted"));
      } catch {
        toast.error(t("failed"));
      }
    });

  return { mute, unmute, isPending };
};
