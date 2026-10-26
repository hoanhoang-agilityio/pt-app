"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  CONFIRM_MESSAGES,
  WORKOUT_MESSAGES,
} from "@/features/workouts/constants/messages";
import {
  deleteExerciseAction,
  moveExerciseAction,
} from "@/features/workouts/services/workout-actions";
import type { MoveDirection } from "@/features/workouts/types/workout";
import { getDeleteConfirmMessage } from "@/features/workouts/utils/exercise";
import { describeErrorReference } from "@/utils/errors";

export const useExerciseItemActions = (
  exerciseId: number,
  userId: number,
  hasSets: boolean,
) => {
  const [isPending, startTransition] = useTransition();

  const handleMove = (direction: MoveDirection) => {
    startTransition(async () => {
      const result = await moveExerciseAction(exerciseId, userId, direction);

      if (result.status === "error") {
        toast.error(result.message, {
          description: describeErrorReference(result.reference),
        });
      }
    });
  };

  const handleDelete = () => {
    if (!window.confirm(getDeleteConfirmMessage(hasSets))) {
      return;
    }

    startTransition(async () => {
      let result = await deleteExerciseAction(exerciseId, userId, {
        confirmDeleteSets: hasSets,
      });

      // Sets were logged after this page loaded: the server changed nothing
      // and refreshed the page, so only the warning is missing.
      if (result.status === "needs-confirm") {
        if (!window.confirm(CONFIRM_MESSAGES.DELETE_EXERCISE_WITH_SETS)) {
          return;
        }
        result = await deleteExerciseAction(exerciseId, userId, {
          confirmDeleteSets: true,
        });
      }

      if (result.status === "error") {
        toast.error(result.message, {
          description: describeErrorReference(result.reference),
        });
        return;
      }
      if (result.status === "success") {
        toast.success(WORKOUT_MESSAGES.EXERCISE_DELETED);
      }
    });
  };

  return { isPending, handleMove, handleDelete };
};
