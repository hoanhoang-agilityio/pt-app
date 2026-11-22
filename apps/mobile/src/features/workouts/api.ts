import {
  completionResponseSchema,
  saveSetsResponseSchema,
  scheduleResponseSchema,
  type SetInput,
} from "@pt/contracts";

import { api } from "@/lib/api";

// The trainee's own workouts (/v1/me/*).

export const fetchSchedule = (from: string, to: string) =>
  api.get("/v1/me/workout-days", {
    query: { from, to },
    schema: scheduleResponseSchema,
  });

export const saveSets = (exerciseId: number, sets: SetInput[]) =>
  api.put(`/v1/me/exercises/${exerciseId}/sets`, {
    body: { sets },
    schema: saveSetsResponseSchema,
  });

export const setCompletion = (exerciseId: number, completed: boolean) =>
  api.put(`/v1/me/exercises/${exerciseId}/completion`, {
    body: { completed },
    schema: completionResponseSchema,
  });
