"use client";

import { useTranslations } from "next-intl";

import {
  BACK_SHAPES,
  DIAGRAM_VIEWBOX,
  FRONT_SHAPES,
  type MuscleShape,
} from "@/features/exercise-library/constants/muscle-paths";
import type { MuscleKey } from "@/features/exercise-library/constants/muscles";
import { cn } from "@/utils/cn";

interface MuscleDiagramProps {
  primary: MuscleKey[];
  secondary: MuscleKey[];
  // "sm" for rows and cards (no captions), "lg" for the detail sheet.
  size?: "sm" | "lg";
  className?: string;
}

// Fills come from the theme tokens, so dark mode and the app's accent color
// follow without extra work.
const FILL = {
  primary: "var(--accent)",
  secondary: "color-mix(in srgb, var(--accent) 38%, var(--surface))",
  neutral: "color-mix(in srgb, var(--fg) 13%, var(--surface))",
} as const;

const fillOf = (
  shape: MuscleShape,
  primary: MuscleKey[],
  secondary: MuscleKey[],
) => {
  if (shape.muscles?.some((key) => primary.includes(key))) {
    return FILL.primary;
  }
  return shape.muscles?.some((key) => secondary.includes(key))
    ? FILL.secondary
    : FILL.neutral;
};

const Body = ({
  shapes,
  primary,
  secondary,
  className,
}: {
  shapes: MuscleShape[];
  primary: MuscleKey[];
  secondary: MuscleKey[];
  className: string;
}) => (
  <svg
    viewBox={DIAGRAM_VIEWBOX}
    className={className}
    aria-hidden
    focusable="false"
  >
    {shapes.map((shape, index) => (
      <polygon
        key={index}
        points={shape.points}
        fill={fillOf(shape, primary, secondary)}
        stroke="var(--surface)"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
    ))}
  </svg>
);

// Front and back of the body with the worked muscles highlighted: primary in
// the accent color, secondary in a lighter tint, the rest neutral.
export const MuscleDiagram = ({
  primary,
  secondary,
  size = "sm",
  className,
}: MuscleDiagramProps) => {
  const t = useTranslations("exerciseLibrary");
  const tMuscles = useTranslations("exerciseLibrary.muscles");
  const names = (keys: MuscleKey[]) =>
    keys.map((key) => tMuscles(key)).join(", ");
  let label = t("diagram.labelNone");

  if (primary.length > 0 && secondary.length > 0) {
    label = t("diagram.label", {
      primary: names(primary),
      secondary: names(secondary),
    });
  } else if (primary.length > 0 || secondary.length > 0) {
    label = t("diagram.labelPrimaryOnly", {
      primary: names(primary.length > 0 ? primary : secondary),
    });
  }
  const bodyClass = size === "lg" ? "h-64" : "h-14";

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex shrink-0 items-end justify-center",
        size === "lg" ? "gap-6" : "gap-0.5",
        className,
      )}
    >
      {(
        [
          ["front", FRONT_SHAPES],
          ["back", BACK_SHAPES],
        ] as const
      ).map(([side, shapes]) => (
        <figure key={side} className="m-0 flex flex-col items-center gap-1.5">
          <Body
            shapes={shapes}
            primary={primary}
            secondary={secondary}
            className={cn("w-auto", bodyClass)}
          />
          {size === "lg" && (
            <figcaption className="text-xs font-medium text-muted" aria-hidden>
              {t(`diagram.${side}`)}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
};
