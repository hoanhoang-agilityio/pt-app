import clsx from "clsx";
import { Dumbbell, User, Utensils } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { getContrastReport } from "@/features/theme/utils/contrast";

interface ThemePreviewProps {
  // A normalized "#rrggbb".
  accent: string;
}

type Mode = "light" | "dark";

// The page tokens of app/globals.css for each mode.
const SURFACES: Record<Mode, Record<string, string>> = {
  light: {
    "--bg": "#f4f4f5",
    "--surface": "#ffffff",
    "--fg": "#111113",
    "--muted": "#6b6b76",
    "--line": "#e4e4e9",
  },
  dark: {
    "--bg": "#0c0c0e",
    "--surface": "#18181b",
    "--fg": "#f4f4f5",
    "--muted": "#a1a1aa",
    "--line": "#2a2a30",
  },
};

const Panel = ({ mode, accent }: { mode: Mode; accent: string }) => {
  const t = useTranslations("theme.preview");
  const report = getContrastReport(accent);
  const isDark = mode === "dark";
  // Same tokens the app overrides: --accent and --accent-fg (the dark mode
  // gets the derived variant).
  const style = {
    ...SURFACES[mode],
    "--accent": isDark ? report.darkAccent : accent,
    "--accent-fg": isDark
      ? getContrastReport(report.darkAccent).foreground
      : report.foreground,
    colorScheme: mode,
  } as CSSProperties;
  const tabs = [
    { key: "workouts", icon: Dumbbell },
    { key: "nutrition", icon: Utensils },
    { key: "account", icon: User },
  ] as const;

  return (
    <div
      style={style}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-bg p-3 text-fg"
    >
      <p className="text-xs font-medium text-muted">{t(mode)}</p>
      <button
        type="button"
        tabIndex={-1}
        className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg"
      >
        {t("button")}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent ring-1 ring-accent/30">
          {t("chip")}
        </span>
        <span
          aria-hidden
          className="flex h-6 w-10 shrink-0 items-center rounded-full bg-accent p-0.5"
        >
          <span className="size-5 translate-x-4 rounded-full bg-white shadow-sm" />
        </span>
      </div>
      <div
        role="img"
        aria-label={t("progress")}
        className="h-2 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full w-3/5 rounded-full bg-accent" />
      </div>
      <div className="grid grid-cols-3 rounded-xl border border-line bg-surface py-1.5">
        {tabs.map(({ key, icon: Icon }, index) => (
          <span
            key={key}
            className={clsx(
              "flex flex-col items-center gap-0.5 text-caption font-medium",
              index === 0 ? "text-accent" : "text-muted",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {t(`tabs.${key}`)}
          </span>
        ))}
      </div>
    </div>
  );
};

// A primary button, chip, toggle, progress bar and bottom tab bar in light and
// dark mode side by side, painted with the accent that would be saved.
export const ThemePreview = ({ accent }: ThemePreviewProps) => (
  <div className="grid grid-cols-2 gap-3" aria-hidden>
    <Panel mode="light" accent={accent} />
    <Panel mode="dark" accent={accent} />
  </div>
);
