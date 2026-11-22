import type { ScheduleResponse, SetInput } from "@pt/contracts";
import { addDays } from "@pt/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSchedule, saveSets, setCompletion } from "./api";

export const workoutKeys = {
  all: ["workouts"] as const,
  week: (weekStart: string) => ["workouts", "week", weekStart] as const,
};

export const useWeekSchedule = (weekStart: string) =>
  useQuery({
    queryKey: workoutKeys.week(weekStart),
    queryFn: () => fetchSchedule(weekStart, addDays(weekStart, 6)),
  });

export const useSaveSets = (exerciseId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sets: SetInput[]) => saveSets(exerciseId, sets),
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });
};

const patchCompletion = (
  data: ScheduleResponse | undefined,
  exerciseId: number,
  completedAt: string | null,
): ScheduleResponse | undefined =>
  data && {
    days: data.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, completedAt } : exercise,
      ),
    })),
  };

// Flips the card at once; a failure restores the real state.
export const useSetCompletion = (exerciseId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (completed: boolean) => setCompletion(exerciseId, completed),
    onMutate: (completed) => {
      queryClient.setQueriesData<ScheduleResponse>(
        { queryKey: [...workoutKeys.all, "week"] },
        (data) =>
          patchCompletion(data, exerciseId, completed ? new Date().toISOString() : null),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });
};
