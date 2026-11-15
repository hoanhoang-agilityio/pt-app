"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/common/Spinner";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CARD,
  SECTION_TITLE,
} from "@/constants/styles";
import { ColorPicker } from "@/features/theme/components/ColorPicker";
import { ContrastNotice } from "@/features/theme/components/ContrastNotice";
import { ThemePreview } from "@/features/theme/components/ThemePreview";
import { DEFAULT_ACCENT } from "@/features/theme/constants/theme";
import { useColorDraft } from "@/features/theme/hooks/use-color-draft";
import { setMyAccentColorAction } from "@/features/theme/services/theme-actions";
import {
  fixForLightMode,
  getContrastReport,
} from "@/features/theme/utils/contrast";

interface MyThemeSettingsProps {
  // Which session the color belongs to (a browser can hold both).
  audience: "user" | "admin";
  // The saved personal color, "#rrggbb"; null = default.
  saved: string | null;
}

// Personal picker for a trainee or a PT: one color that applies only to this
// person, with the same live preview, contrast check and reset as the super
// admin screen.
export const MyThemeSettings = ({
  audience,
  saved: initialSaved,
}: MyThemeSettingsProps) => {
  const t = useTranslations("theme");
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();
  const draft = useColorDraft(initialSaved ?? DEFAULT_ACCENT);
  const report = getContrastReport(draft.hex);
  const isChanged = draft.hex !== (saved ?? DEFAULT_ACCENT);

  // `color` null resets to the default.
  const save = (color: string | null) => {
    startTransition(async () => {
      try {
        const result = await setMyAccentColorAction({ color, audience });

        if (result.status !== "success") {
          toast.error(result.message ?? t("actions.failed"));
          router.refresh();
          return;
        }
        setSaved(color);
        if (color === null) {
          draft.setHex(DEFAULT_ACCENT);
        }
        toast.success(
          color === null ? t("actions.resetDone") : t("actions.saved"),
        );
        router.refresh();
      } catch {
        toast.error(t("actions.failed"));
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-labelledby="theme-preview-title">
        <h2 id="theme-preview-title" className={SECTION_TITLE}>
          {t("preview.title")}
        </h2>
        <ThemePreview accent={draft.hex} />
      </section>

      <section className="space-y-3" aria-labelledby="theme-picker-title">
        <h2 id="theme-picker-title" className={SECTION_TITLE}>
          {t("picker.title")}
        </h2>
        <div className={`${CARD} p-4`}>
          <ColorPicker
            hex={draft.hex}
            rgb={draft.rgb}
            hsl={draft.hsl}
            disabled={isPending}
            onHex={draft.setHex}
            onRgb={draft.setRgb}
            onHsl={draft.setHsl}
          />
        </div>
        <ContrastNotice
          report={report}
          disabled={isPending}
          onFix={() => draft.setHex(fixForLightMode(draft.hex))}
        />
      </section>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => save(draft.hex)}
          disabled={isPending || !isChanged}
          aria-busy={isPending}
          className={BUTTON_PRIMARY}
        >
          {isPending && <Spinner size="md" />}
          {isPending ? t("actions.saving") : t("actions.save")}
        </button>
        <button
          type="button"
          onClick={() => save(null)}
          disabled={isPending || saved === null}
          className={BUTTON_SECONDARY}
        >
          {t("actions.reset")}
        </button>
      </div>
    </div>
  );
};
