"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { MuscleChips } from "@/features/exercise-library/components/MuscleChips";
import { MuscleDiagram } from "@/features/exercise-library/components/MuscleDiagram";
import { useEquipmentLabel } from "@/features/exercise-library/hooks/use-equipment-label";
import type { ExerciseRow } from "@/features/exercise-library/types/exercise";

interface ExerciseRowItemProps {
  exercise: ExerciseRow;
  onSelect: (exercise: ExerciseRow) => void;
  // Names the row's action for screen readers, e.g. "Xem Squat".
  actionLabel: string;
}

// One exercise in a list: the small diagram, the name, its muscles. The whole
// row is one button (min 56px tall).
export const ExerciseRowItem = ({
  exercise,
  onSelect,
  actionLabel,
}: ExerciseRowItemProps) => {
  const t = useTranslations("exerciseLibrary");
  const equipment = useEquipmentLabel()(exercise.equipment, exercise.isCustom);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(exercise)}
        aria-label={actionLabel}
        className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition active:bg-line/40 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
      >
        <MuscleDiagram
          primary={exercise.primary}
          secondary={exercise.secondary}
          className="w-14"
        />
        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-1">
          <span className="flex items-start gap-2">
            <span className="min-w-0 text-base font-semibold [overflow-wrap:anywhere] text-fg">
              {exercise.name}
            </span>
            {exercise.isCustom && (
              <span className="shrink-0 self-start rounded-full border border-accent/40 px-2 text-xs leading-5 font-medium text-accent">
                {t("custom")}
              </span>
            )}
          </span>
          <MuscleChips
            primary={exercise.primary}
            secondary={exercise.secondary}
          />
          {equipment && (
            <span className="text-xs [overflow-wrap:anywhere] text-muted">
              {equipment}
            </span>
          )}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );
};
