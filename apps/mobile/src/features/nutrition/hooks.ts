import type { AddMealLogBody, FoodGroup } from "@pt/contracts";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  addMealLog,
  type BodyProfileInput,
  createFoodEntry,
  deleteFoodEntry,
  fetchFoodGroups,
  fetchFoods,
  fetchMealPlanWeek,
  fetchOverview,
  type FoodEntryInput,
  removeMealLog,
  saveBodyProfile,
  saveMealPreferences,
  saveWeight,
  setMealMark,
  updateFoodEntry,
  type UpdateLogInput,
  updateMealLog,
} from "./api";

export const nutritionKeys = {
  all: ["nutrition"] as const,
  overview: (week: string) => ["nutrition", "overview", week] as const,
  plan: (week: string) => ["nutrition", "plan", week] as const,
  foods: (q: string, group: string | null, locale: string) =>
    ["nutrition", "foods", q, group, locale] as const,
  groups: ["nutrition", "groups"] as const,
};

export const useOverview = (week: string) =>
  useQuery({ queryKey: nutritionKeys.overview(week), queryFn: () => fetchOverview(week) });

export const useMealPlanWeek = (week: string) =>
  useQuery({ queryKey: nutritionKeys.plan(week), queryFn: () => fetchMealPlanWeek(week) });

// Everything the nutrition screens read depends on the same few rows.
const useInvalidateNutrition = () => {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: nutritionKeys.all });
};

export const useSaveBodyProfile = () => {
  const invalidate = useInvalidateNutrition();

  return useMutation({
    mutationFn: (body: BodyProfileInput) => saveBodyProfile(body),
    onSuccess: invalidate,
  });
};

export const useSaveWeight = () => {
  const invalidate = useInvalidateNutrition();

  return useMutation({
    mutationFn: ({ date, weightKg }: { date: string; weightKg: string }) =>
      saveWeight(date, weightKg),
    onSuccess: invalidate,
  });
};

export const useSaveFoodEntry = () => {
  const invalidate = useInvalidateNutrition();

  return useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: FoodEntryInput }) =>
      id === null ? createFoodEntry(body) : updateFoodEntry(id, body),
    onSuccess: invalidate,
  });
};

export const useDeleteFoodEntry = () => {
  const invalidate = useInvalidateNutrition();

  return useMutation({ mutationFn: deleteFoodEntry, onSuccess: invalidate });
};

export const useSavePreferences = () => {
  const invalidate = useInvalidateNutrition();

  return useMutation({ mutationFn: saveMealPreferences, onSuccess: invalidate });
};

export const useAddMealLog = (mealId: number) => {
  const invalidate = useInvalidateNutrition();

  return useMutation({
    mutationFn: (body: AddMealLogBody) => addMealLog(mealId, body),
    onSuccess: invalidate,
  });
};

export const useUpdateMealLog = () => {
  const invalidate = useInvalidateNutrition();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateLogInput }) =>
      updateMealLog(id, body),
    onSuccess: invalidate,
  });
};

export const useRemoveMealLog = () => {
  const invalidate = useInvalidateNutrition();

  return useMutation({ mutationFn: removeMealLog, onSuccess: invalidate });
};

export const useSetMealMark = () => {
  const invalidate = useInvalidateNutrition();

  return useMutation({
    mutationFn: ({
      mealId,
      body,
    }: {
      mealId: number;
      body: { achieved: boolean; note: string };
    }) => setMealMark(mealId, body),
    onSuccess: invalidate,
  });
};

export const useFoodSearch = (
  q: string,
  group: FoodGroup | null,
  locale: "vi" | "en" | "zh",
  enabled = true,
) => {
  const query = useInfiniteQuery({
    queryKey: nutritionKeys.foods(q, group, locale),
    queryFn: ({ pageParam }) =>
      fetchFoods({ q, group: group ?? undefined, locale, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
    staleTime: 60_000,
  });

  return { ...query, foods: query.data?.pages.flatMap((page) => page.items) ?? [] };
};

export const useFoodGroups = () =>
  useQuery({ queryKey: nutritionKeys.groups, queryFn: fetchFoodGroups, staleTime: 300_000 });
