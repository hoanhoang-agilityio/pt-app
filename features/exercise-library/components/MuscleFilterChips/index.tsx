"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";

import {
  MUSCLE_KEYS,
  type MuscleKey,
} from "@/features/exercise-library/constants/muscles";

interface MuscleFilterChipsProps {
  value: MuscleKey | undefined;
  onChange: (value: MuscleKey | undefined) => void;
  label: string;
}

const CHIP =
  "inline-flex min-h-10 shrink-0 snap-start items-center rounded-full border px-4 text-sm font-semibold transition";
const CHIP_SELECTED = "border-accent bg-accent text-accent-fg";
const CHIP_IDLE = "border-line bg-surface text-fg";

// One row of chips that scrolls sideways; one muscle group at a time.
export const MuscleFilterChips = ({
  value,
  onChange,
  label,
}: MuscleFilterChipsProps) => {
  const t = useTranslations("exerciseLibrary");
  const tMuscles = useTranslations("exerciseLibrary.muscles");

  return (
    <div className="relative -mx-4">
      <div
        role="group"
        aria-label={label}
        className="flex snap-x snap-proximity scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      >
        <button
          type="button"
          aria-pressed={value === undefined}
          onClick={() => onChange(undefined)}
          className={clsx(
            CHIP,
            value === undefined ? CHIP_SELECTED : CHIP_IDLE,
          )}
        >
          {t("all")}
        </button>
        {MUSCLE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(value === key ? undefined : key)}
            className={clsx(CHIP, value === key ? CHIP_SELECTED : CHIP_IDLE)}
          >
            {tMuscles(key)}
          </button>
        ))}
      </div>
    </div>
  );
};
