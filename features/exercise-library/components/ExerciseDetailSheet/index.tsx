"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/common/BottomSheet";
import { Spinner } from "@/components/common/Spinner";
import {
  BUTTON_SECONDARY,
  FIELD_ERROR,
  SECTION_TITLE,
} from "@/constants/styles";
import { ExerciseImage } from "@/features/exercise-library/components/ExerciseImage";
import { MuscleChips } from "@/features/exercise-library/components/MuscleChips";
import { MuscleDiagram } from "@/features/exercise-library/components/MuscleDiagram";
import {
  CATEGORY_KEYS,
  isLabelKey,
  LEVEL_KEYS,
  toLabelKey,
} from "@/features/exercise-library/constants/labels";
import { useEquipmentLabel } from "@/features/exercise-library/hooks/use-equipment-label";
import { getExercise } from "@/features/exercise-library/services/exercise-actions";
import type {
  ExerciseDetail,
  ExerciseRow,
} from "@/features/exercise-library/types/exercise";

interface ExerciseDetailSheetProps {
  // null = closed.
  exercise: ExerciseRow | null;
  onClose: () => void;
  onEdit: (exercise: ExerciseDetail) => void;
}

interface Loaded {
  ref: string;
  detail: ExerciseDetail | null;
}

const levelLabel = (
  t: ReturnType<typeof useTranslations<"exerciseLibrary.levels">>,
  level: string,
) => (isLabelKey(LEVEL_KEYS, level) ? t(level) : level);

const categoryLabel = (
  t: ReturnType<typeof useTranslations<"exerciseLibrary.categories">>,
  category: string,
) => {
  const key = toLabelKey(category);

  return isLabelKey(CATEGORY_KEYS, key) ? t(key) : category;
};

// The big picture of one exercise. The diagram, muscles and photo come from
// the row at once; the steps, level and type load by ref.
export const ExerciseDetailSheet = ({
  exercise,
  onClose,
  onEdit,
}: ExerciseDetailSheetProps) => {
  const t = useTranslations("exerciseLibrary");
  const tLevels = useTranslations("exerciseLibrary.levels");
  const tCategories = useTranslations("exerciseLibrary.categories");
  const labelOf = useEquipmentLabel();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const ref = exercise?.ref;

  useEffect(() => {
    if (!ref) {
      return;
    }
    let isCurrent = true;

    getExercise(ref)
      .then((result) => {
        if (isCurrent) {
          setLoaded({
            ref,
            detail: result.status === "success" ? result.exercise : null,
          });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setLoaded({ ref, detail: null });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [ref]);

  // Kept while the sheet closes so its content does not flash empty.
  const [shown, setShown] = useState<ExerciseRow | null>(null);

  if (exercise && shown?.ref !== exercise.ref) {
    setShown(exercise);
  }
  const row = exercise ?? shown;
  const isSettled = loaded !== null && loaded.ref === row?.ref;
  const detail = isSettled ? loaded.detail : null;
  const isLoading = Boolean(row) && !isSettled;
  const hasFailed = Boolean(row) && isSettled && !loaded.detail;
  const equipment = row ? labelOf(row.equipment, row.isCustom) : null;

  return (
    <BottomSheet
      isOpen={exercise !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      title={row?.name ?? ""}
      description={row?.isCustom ? t("custom") : undefined}
    >
      {row && (
        <div className="space-y-5">
          <div className="flex justify-center rounded-2xl border border-line bg-surface py-4">
            <MuscleDiagram
              primary={row.primary}
              secondary={row.secondary}
              size="lg"
            />
          </div>
          <dl className="space-y-3">
            <div className="space-y-1.5">
              <dt className={SECTION_TITLE}>{t("detail.primary")}</dt>
              <dd>
                {row.primary.length > 0 ? (
                  <MuscleChips primary={row.primary} max={17} />
                ) : (
                  <span className="text-sm text-muted">{t("detail.none")}</span>
                )}
              </dd>
            </div>
            {row.secondary.length > 0 && (
              <div className="space-y-1.5">
                <dt className={SECTION_TITLE}>{t("detail.secondary")}</dt>
                <dd>
                  <MuscleChips
                    primary={[]}
                    secondary={row.secondary}
                    max={17}
                  />
                </dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {equipment && (
                <div className="space-y-1">
                  <dt className={SECTION_TITLE}>{t("detail.equipment")}</dt>
                  <dd className="text-sm font-medium text-fg">{equipment}</dd>
                </div>
              )}
              {detail?.level && (
                <div className="space-y-1">
                  <dt className={SECTION_TITLE}>{t("detail.level")}</dt>
                  <dd className="text-sm font-medium text-fg">
                    {levelLabel(tLevels, detail.level)}
                  </dd>
                </div>
              )}
              {detail?.category && (
                <div className="space-y-1">
                  <dt className={SECTION_TITLE}>{t("detail.category")}</dt>
                  <dd className="text-sm font-medium text-fg">
                    {categoryLabel(tCategories, detail.category)}
                  </dd>
                </div>
              )}
            </div>
          </dl>
          {row.imageUrl && (
            <ExerciseImage
              src={row.imageUrl}
              alt={t("detail.photo")}
              className="aspect-[4/3] w-full"
            />
          )}
          {isLoading && (
            <div className="flex justify-center py-2 text-muted">
              <Spinner />
            </div>
          )}
          {hasFailed && <p className={FIELD_ERROR}>{t("detail.loadFailed")}</p>}
          {detail && detail.instructions.length > 0 && (
            <section className="space-y-2">
              <h3 className={SECTION_TITLE}>{t("detail.instructions")}</h3>
              <ol className="space-y-2 text-sm text-fg">
                {detail.instructions.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-line/60 text-xs font-semibold text-muted tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {detail?.isCustom && (
            <button
              type="button"
              onClick={() => onEdit(detail)}
              className={`${BUTTON_SECONDARY} w-full`}
            >
              <Pencil className="size-5" aria-hidden />
              {t("detail.edit")}
            </button>
          )}
        </div>
      )}
    </BottomSheet>
  );
};
