import clsx from "clsx";

import type { MacroShare } from "@/features/foods/types/food";
import {
  MACRO_COLORS,
  MACRO_LABELS,
} from "@/features/nutrition/constants/nutrition";

interface MacroSplitBarProps {
  split: MacroShare;
}

const SEGMENTS = ["protein", "carbs", "fat"] as const;

// Share of the food's calories that comes from protein, carbs and fat.
export const MacroSplitBar = ({ split }: MacroSplitBarProps) => {
  const description = SEGMENTS.map(
    (macro) => `${MACRO_LABELS[macro].name} ${split[macro]}%`,
  ).join(", ");

  return (
    <div
      role="img"
      aria-label={`Tỉ lệ calo: ${description}`}
      className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-line"
    >
      {SEGMENTS.map(
        (macro) =>
          split[macro] > 0 && (
            <div
              key={macro}
              className={clsx("h-full", MACRO_COLORS[macro].bar)}
              style={{ width: `${split[macro]}%` }}
            />
          ),
      )}
    </div>
  );
};
