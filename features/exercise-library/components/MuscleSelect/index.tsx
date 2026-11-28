"use client";

import clsx from "clsx";
import { useTranslations } from "next-intl";

import {
  MUSCLE_KEYS,
  type MuscleKey,
} from "@/features/exercise-library/constants/muscles";

interface MuscleSelectProps {
  label: string;
  value: MuscleKey[];
  onChange: (value: MuscleKey[]) => void;
  // Muscles that cannot be picked here (already chosen in the other list).
  disabled?: MuscleKey[];
}

// Multi-select chips: each is a toggle button. Wraps, so every group is
// visible at once on a phone.
export const MuscleSelect = ({
  label,
  value,
  onChange,
  disabled = [],
}: MuscleSelectProps) => {
  const t = useTranslations("exerciseLibrary.muscles");

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {MUSCLE_KEYS.map((key) => {
        const isOn = value.includes(key);

        return (
          <button
            key={key}
            type="button"
            aria-pressed={isOn}
            disabled={disabled.includes(key)}
            onClick={() =>
              onChange(
                isOn ? value.filter((item) => item !== key) : [...value, key],
              )
            }
            className={clsx(
              "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition disabled:opacity-35",
              isOn
                ? "border-accent bg-accent text-accent-fg"
                : "border-line bg-surface text-fg",
            )}
          >
            {t(key)}
          </button>
        );
      })}
    </div>
  );
};
