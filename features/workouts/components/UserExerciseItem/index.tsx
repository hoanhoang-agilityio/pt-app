"use client";

import { CompletionToggle } from "@/features/workouts/components/CompletionToggle";
import { ExerciseCard } from "@/features/workouts/components/ExerciseCard";
import { SetLogger } from "@/features/workouts/components/SetLogger";
import { useExerciseCompletion } from "@/features/workouts/hooks/use-exercise-completion";
import type { ExerciseWithSets } from "@/features/workouts/types/workout";
import {
  canLogSets,
  getLoggedSetsKey,
} from "@/features/workouts/utils/set-rows";

interface UserExerciseItemProps {
  exercise: ExerciseWithSets;
  index: number;
  canComplete: boolean;
}

export const UserExerciseItem = ({
  exercise,
  index,
  canComplete,
}: UserExerciseItemProps) => {
  const { completedAt, isPending, handleToggle } =
    useExerciseCompletion(exercise);

  return (
    <ExerciseCard
      exercise={{ ...exercise, completedAt }}
      index={index}
      footer={
        <>
          {canLogSets(exercise, canComplete) && (
            <SetLogger
              key={getLoggedSetsKey(exercise.loggedSets)}
              exercise={exercise}
            />
          )}
          <CompletionToggle
            completedAt={completedAt}
            canComplete={canComplete}
            isPending={isPending}
            onToggle={handleToggle}
          />
        </>
      }
    />
  );
};
