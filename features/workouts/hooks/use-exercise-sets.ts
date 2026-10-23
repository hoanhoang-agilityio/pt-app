"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  SET_LIMITS,
  WORKOUT_MESSAGES,
} from "@/features/workouts/constants/messages";
import { SET_LOGGER_COPY } from "@/features/workouts/constants/set-logger";
import { saveExerciseSetsAction } from "@/features/workouts/services/set-actions";
import type { ExerciseWithSets } from "@/features/workouts/types/workout";
import {
  createInitialRows,
  rowsToSetInputs,
  type SetRowDraft,
  type SetRowField,
} from "@/features/workouts/utils/set-rows";
import { describeErrorReference } from "@/utils/errors";

// Local rows for one exercise, seeded once from `loggedSets`. The caller keys
// the logger by the saved sets, so rows restart only when the server's list
// changes (a save here or on another device), never while typing. Saving
// revalidates the page, so the completion toggle shows "Đã tập xong" when the
// transition ends.
export const useExerciseSets = (
  exercise: Pick<ExerciseWithSets, "id" | "sets" | "loggedSets">,
) => {
  const [rows, setRows] = useState<SetRowDraft[]>(() =>
    createInitialRows(exercise.loggedSets, exercise.sets),
  );
  const nextId = useRef(rows.length);
  const [isPending, startTransition] = useTransition();

  const canAdd = rows.length < SET_LIMITS.MAX_ROWS;
  const canRemove = rows.length > 1;

  const addRow = () => {
    const id = nextId.current++;

    setRows((current) =>
      current.length < SET_LIMITS.MAX_ROWS
        ? [...current, { id, weight: "", reps: "" }]
        : current,
    );
  };

  const removeRow = (id: number) => {
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.id !== id) : current,
    );
  };

  const updateRow = (id: number, field: SetRowField, value: string) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const handleSave = () => {
    const parsed = rowsToSetInputs(rows);

    if (!parsed.ok) {
      toast.error(parsed.message);
      return;
    }

    startTransition(async () => {
      const result = await saveExerciseSetsAction(exercise.id, parsed.sets);

      if (result.status === "error") {
        toast.error(result.message, {
          description: describeErrorReference(result.reference),
        });
        return;
      }
      toast.success(
        result.personalBest
          ? SET_LOGGER_COPY.PERSONAL_BEST
          : WORKOUT_MESSAGES.SETS_SAVED,
      );
    });
  };

  return {
    rows,
    canAdd,
    canRemove,
    isPending,
    addRow,
    removeRow,
    updateRow,
    handleSave,
  };
};
