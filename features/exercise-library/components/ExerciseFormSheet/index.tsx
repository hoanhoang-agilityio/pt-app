"use client";

import { ImagePlus, Save, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { BottomSheet } from "@/components/common/BottomSheet";
import { useConfirm } from "@/components/common/ConfirmDialog/use-confirm";
import { Input } from "@/components/common/Input";
import { SubmitButton } from "@/components/common/SubmitButton";
import {
  BUTTON_DANGER,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FIELD_ERROR,
  LABEL,
  TEXTAREA,
} from "@/constants/styles";
import { ExerciseImage } from "@/features/exercise-library/components/ExerciseImage";
import { MuscleDiagram } from "@/features/exercise-library/components/MuscleDiagram";
import { MuscleSelect } from "@/features/exercise-library/components/MuscleSelect";
import {
  EXERCISE_EQUIPMENT_MAX,
  EXERCISE_INSTRUCTIONS_MAX,
  EXERCISE_NAME_MAX,
} from "@/features/exercise-library/constants/limits";
import type { MuscleKey } from "@/features/exercise-library/constants/muscles";
import {
  createExercise,
  deleteExercise,
  updateExercise,
} from "@/features/exercise-library/services/exercise-actions";
import type { ExerciseDetail } from "@/features/exercise-library/types/exercise";
import { encodeExercisePhoto } from "@/features/exercise-library/utils/encode-exercise-photo";

interface ExerciseFormSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // null = a new exercise.
  exercise: ExerciseDetail | null;
  // After a create, update or delete, so the lists can reload.
  onSaved: () => void;
}

// Where the photo stands: untouched (undefined keeps the saved one on update),
// removed (null) or a new data URL.
type PhotoChange = string | null | undefined;

// The form is remounted by `key` for each exercise, so its state starts from
// the exercise it opens with.
const ExerciseForm = ({
  exercise,
  onDone,
}: {
  exercise: ExerciseDetail | null;
  onDone: () => void;
}) => {
  const t = useTranslations("exerciseLibrary.form");
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(exercise?.name ?? "");
  const [primary, setPrimary] = useState<MuscleKey[]>(exercise?.primary ?? []);
  const [secondary, setSecondary] = useState<MuscleKey[]>(
    exercise?.secondary ?? [],
  );
  const [equipment, setEquipment] = useState(exercise?.equipment ?? "");
  const [instructions, setInstructions] = useState(
    exercise?.instructions.join("\n") ?? "",
  );
  const [photo, setPhoto] = useState<PhotoChange>(undefined);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  // What the photo area shows: a new photo, nothing (removed) or the saved one.
  const shownPhoto = photo === undefined ? (exercise?.imageUrl ?? null) : photo;

  const pickPhoto = async (file: File | undefined) => {
    setError(undefined);
    if (!file) {
      return;
    }
    try {
      setPhoto(await encodeExercisePhoto(file));
    } catch {
      setError(t("photoUnreadable"));
    }
    if (input.current) {
      input.current.value = "";
    }
  };

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const values = {
        name,
        primary,
        secondary,
        equipment,
        instructions,
        photo,
      };
      const result = exercise?.customId
        ? await updateExercise(exercise.customId, values)
        : await createExercise(values);

      if (result.status !== "success") {
        setError(result.message);
        return;
      }
      toast.success(t("saved"));
      onDone();
    });
  };

  const remove = async () => {
    if (!exercise?.customId) {
      return;
    }
    const customId = exercise.customId;
    const isConfirmed = await confirm({
      title: t("deleteTitle"),
      description: t("deleteBody"),
      confirmLabel: t("deleteConfirm"),
      isDanger: true,
    });

    if (!isConfirmed) {
      return;
    }
    startDelete(async () => {
      const result = await deleteExercise(customId);

      if (result.status !== "success") {
        setError(result.message);
        return;
      }
      toast.success(t("deleted"));
      onDone();
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <div>
        <label htmlFor="exercise-name" className={LABEL}>
          {t("name")}
        </label>
        <Input
          id="exercise-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={EXERCISE_NAME_MAX}
          autoComplete="off"
          required
          clearable
        />
      </div>
      <div className="space-y-2">
        <span className={LABEL}>{t("primary")}</span>
        <MuscleSelect
          label={t("primary")}
          value={primary}
          onChange={(next) => {
            setPrimary(next);
            // A muscle is primary or secondary, not both.
            setSecondary((current) =>
              current.filter((key) => !next.includes(key)),
            );
          }}
        />
        <span className={`${LABEL} pt-1`}>{t("secondary")}</span>
        <MuscleSelect
          label={t("secondary")}
          value={secondary}
          onChange={setSecondary}
          disabled={primary}
        />
        <p className="text-xs text-muted">{t("musclesHint")}</p>
        <div className="flex justify-center rounded-2xl border border-line bg-surface py-3">
          <MuscleDiagram primary={primary} secondary={secondary} />
        </div>
      </div>
      <div>
        <label htmlFor="exercise-equipment" className={LABEL}>
          {t("equipment")}
        </label>
        <Input
          id="exercise-equipment"
          value={equipment}
          onChange={(event) => setEquipment(event.target.value)}
          placeholder={t("equipmentPlaceholder")}
          maxLength={EXERCISE_EQUIPMENT_MAX}
          autoComplete="off"
          clearable
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="exercise-instructions" className={LABEL}>
            {t("instructions")}
          </label>
          <span className="text-xs text-muted tabular-nums">
            {t("instructionsCount", {
              count: instructions.length,
              max: EXERCISE_INSTRUCTIONS_MAX,
            })}
          </span>
        </div>
        <textarea
          id="exercise-instructions"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder={t("instructionsPlaceholder")}
          maxLength={EXERCISE_INSTRUCTIONS_MAX}
          className={TEXTAREA}
        />
      </div>
      <div className="space-y-2">
        <span className={LABEL}>{t("photo")}</span>
        {shownPhoto && (
          <ExerciseImage
            src={shownPhoto}
            alt={t("photo")}
            className="aspect-[4/3] w-full"
          />
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => void pickPhoto(event.target.files?.[0])}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={`${BUTTON_SECONDARY} ${shownPhoto ? "" : "col-span-2"}`}
          >
            <ImagePlus className="size-5" aria-hidden />
            {shownPhoto ? t("photoChange") : t("photoPick")}
          </button>
          {shownPhoto && (
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className={BUTTON_SECONDARY}
            >
              <X className="size-5" aria-hidden />
              {t("photoRemove")}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className={FIELD_ERROR}>
          {error}
        </p>
      )}
      <div className="sticky bottom-0 -mb-[calc(env(safe-area-inset-bottom)+1.25rem)] space-y-2 bg-bg pt-2 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <SubmitButton
          isPending={isPending}
          className={`${BUTTON_PRIMARY} w-full`}
        >
          <Save className="size-5" aria-hidden />
          {t("submit")}
        </SubmitButton>
        {exercise?.customId && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={isDeleting || isPending}
            className={`${BUTTON_DANGER} w-full`}
          >
            <Trash2 className="size-5" aria-hidden />
            {isDeleting ? t("deleting") : t("delete")}
          </button>
        )}
      </div>
    </form>
  );
};

export const ExerciseFormSheet = ({
  isOpen,
  onOpenChange,
  exercise,
  onSaved,
}: ExerciseFormSheetProps) => {
  const t = useTranslations("exerciseLibrary.form");

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={exercise ? t("editTitle") : t("addTitle")}
    >
      <ExerciseForm
        key={exercise?.ref ?? "new"}
        exercise={exercise}
        onDone={() => {
          onSaved();
          onOpenChange(false);
        }}
      />
    </BottomSheet>
  );
};
