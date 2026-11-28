"use client";

import { useTranslations } from "next-intl";

import type { MuscleKey } from "@/features/exercise-library/constants/muscles";
import { cn } from "@/utils/cn";

interface MuscleChipsProps {
  primary: MuscleKey[];
  secondary?: MuscleKey[];
  // Chips shown before "+N".
  max?: number;
  className?: string;
}

// Primary muscles as solid chips, secondary as outlined ones.
export const MuscleChips = ({
  primary,
  secondary = [],
  max = 3,
  className,
}: MuscleChipsProps) => {
  const t = useTranslations("exerciseLibrary.muscles");
  const all = [
    ...primary.map((key) => ({ key, isPrimary: true })),
    ...secondary.map((key) => ({ key, isPrimary: false })),
  ];
  const shown = all.slice(0, max);
  const hidden = all.length - shown.length;

  return (
    <ul className={cn("flex flex-wrap gap-1", className)}>
      {shown.map(({ key, isPrimary }) => (
        <li
          key={key}
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2 text-xs font-medium",
            isPrimary
              ? "bg-[color-mix(in_srgb,var(--accent)_16%,var(--surface))] text-accent"
              : "border border-line text-muted",
          )}
        >
          {t(key)}
        </li>
      ))}
      {hidden > 0 && (
        <li className="inline-flex h-6 items-center px-1 text-xs font-medium text-muted tabular-nums">
          +{hidden}
        </li>
      )}
    </ul>
  );
};
