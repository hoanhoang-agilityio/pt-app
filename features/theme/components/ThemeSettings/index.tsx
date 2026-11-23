"use client";

import clsx from "clsx";
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
import {
  DEFAULT_ACCENT,
  LOCK_SCOPES,
  type LockScope,
  THEME_SCOPES,
  type ThemeScope,
} from "@/features/theme/constants/theme";
import { useColorDraft } from "@/features/theme/hooks/use-color-draft";
import {
  setAccentColorAction,
  setThemeLockAction,
} from "@/features/theme/services/theme-actions";
import {
  fixForLightMode,
  getContrastReport,
} from "@/features/theme/utils/contrast";

type Saved = Record<ThemeScope, string | null>;

interface ThemeSettingsProps {
  // Each scope's saved color, "#rrggbb"; null = default orange.
  saved: Saved;
  // Whether each role is locked out of picking a personal color.
  locks: Record<LockScope, boolean>;
}

// Super admin screen: pick a scope, edit one color with live light and dark
// preview and a contrast check, save or reset to the default.
export const ThemeSettings = ({
  saved: initialSaved,
  locks: initialLocks,
}: ThemeSettingsProps) => {
  const t = useTranslations("theme");
  const router = useRouter();
  const [scope, setScope] = useState<ThemeScope>("self");
  const [saved, setSaved] = useState(initialSaved);
  const [locks, setLocks] = useState(initialLocks);
  const [isPending, startTransition] = useTransition();
  const draft = useColorDraft(initialSaved.self ?? DEFAULT_ACCENT);
  const report = getContrastReport(draft.hex);
  const isChanged = draft.hex !== (saved[scope] ?? DEFAULT_ACCENT);
  const canReset = saved[scope] !== null;

  const chooseScope = (next: ThemeScope) => {
    setScope(next);
    draft.setHex(saved[next] ?? DEFAULT_ACCENT);
  };

  // `color` null resets the scope to the default.
  const save = (color: string | null) => {
    startTransition(async () => {
      try {
        const result = await setAccentColorAction({ scope, color });

        if (result.status !== "success") {
          toast.error(result.message ?? t("actions.failed"));
          return;
        }
        // Saving "all" clears the trainee and pt overrides on the server.
        setSaved((current) => ({
          ...current,
          ...(scope === "all" ? { trainee: null, pt: null } : {}),
          [scope]: color,
        }));
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

  const toggleLock = (lockScope: LockScope) => {
    const locked = !locks[lockScope];

    startTransition(async () => {
      try {
        const result = await setThemeLockAction({ scope: lockScope, locked });

        if (result.status !== "success") {
          toast.error(result.message ?? t("actions.failed"));
          return;
        }
        setLocks((current) => ({ ...current, [lockScope]: locked }));
        toast.success(locked ? t("locks.lockedDone") : t("locks.unlockedDone"));
        router.refresh();
      } catch {
        toast.error(t("actions.failed"));
      }
    });
  };

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2" disabled={isPending}>
        <legend className={SECTION_TITLE}>{t("scope.title")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {THEME_SCOPES.map((value) => {
            const color = saved[value];

            return (
              <label
                key={value}
                className={clsx(
                  CARD,
                  "flex min-h-14 cursor-pointer items-center gap-3 p-3 transition has-[:checked]:ring-2 has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                )}
              >
                <input
                  type="radio"
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => chooseScope(value)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  style={{ backgroundColor: color ?? DEFAULT_ACCENT }}
                  className="size-6 shrink-0 rounded-full border border-line"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">
                    {t(`scope.${value}`)}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {color ? color.toUpperCase() : t("scope.default")}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {scope === "all" && (
          <p className="text-xs text-muted">{t("scope.allHint")}</p>
        )}
      </fieldset>

      <section className="space-y-2" aria-labelledby="theme-locks-title">
        <h2 id="theme-locks-title" className={SECTION_TITLE}>
          {t("locks.title")}
        </h2>
        <div className={`${CARD} divide-y divide-line`}>
          {LOCK_SCOPES.map((lockScope) => (
            <button
              key={lockScope}
              type="button"
              role="switch"
              aria-checked={locks[lockScope]}
              onClick={() => toggleLock(lockScope)}
              disabled={isPending}
              className="flex min-h-14 w-full items-center gap-3 p-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-fg">
                  {t(`locks.${lockScope}`)}
                </span>
                <span className="block text-xs text-muted">
                  {t(`locks.${lockScope}Hint`)}
                </span>
              </span>
              <span
                aria-hidden
                className={clsx(
                  "flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition",
                  locks[lockScope] ? "bg-accent" : "bg-line",
                )}
              >
                <span
                  className={clsx(
                    "size-5 rounded-full bg-white shadow-sm transition-transform",
                    locks[lockScope] && "translate-x-4",
                  )}
                />
              </span>
            </button>
          ))}
        </div>
      </section>

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
          disabled={isPending || !canReset}
          className={BUTTON_SECONDARY}
        >
          {t("actions.reset")}
        </button>
      </div>
    </div>
  );
};
