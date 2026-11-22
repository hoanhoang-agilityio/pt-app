import {
  activityResponseSchema,
  adminAccountListResponseSchema,
  adminAccountSchema,
  adminProfileResponseSchema,
  avatarResponseSchema,
  chatColorResponseSchema,
  chatEnabledResponseSchema,
  copyDayResponseSchema,
  copyInfoResponseSchema,
  copyPlanResultResponseSchema,
  copyWeekResponseSchema,
  dashboardSummaryResponseSchema,
  dmAdminListResponseSchema,
  exerciseResponseSchema,
  foodGroupsResponseSchema,
  foodListResponseSchema,
  foodResponseSchema,
  hiddenUsersResponseSchema,
  hideUsersResponseSchema,
  mealPlanCopyInfoResponseSchema,
  nutritionOverviewResponseSchema,
  nutritionTargetResponseSchema,
  passcodeStatusResponseSchema,
  passwordResetResponseSchema,
  planDayResponseSchema,
  presenceHiddenResponseSchema,
  progressResponseSchema,
  revealHiddenUsersResponseSchema,
  saveBodyProfileResponseSchema,
  scheduleResponseSchema,
  traineeCredentialsResponseSchema,
  traineeDetailSchema,
  traineeListResponseSchema,
  traineeMealPlanWeekResponseSchema,
  traineeRestrictionResponseSchema,
  workoutDayResponseSchema,
} from "@pt/contracts";

import { api } from "@/lib/api";

// REST calls of the admin side (PT and super admin). Role rules are enforced by
// the API; the screens only hide what the role cannot use.

const base = (userId: number) => `/v1/trainees/${userId}`;

// ---- Dashboard ---------------------------------------------------------------

export const fetchDashboard = (week: string | undefined, pt: "all" | "none" | number) =>
  api.get("/v1/dashboard/summary", {
    query: { week, pt: pt === "all" ? undefined : String(pt) },
    schema: dashboardSummaryResponseSchema,
  });

export const fetchActivity = (limit = 15) =>
  api.get("/v1/dashboard/activity", { query: { limit }, schema: activityResponseSchema });

export const fetchTraineeActivity = (userId: number, limit = 20) =>
  api.get(`${base(userId)}/activity`, { query: { limit }, schema: activityResponseSchema });

export const fetchTraineeProgress = (userId: number, week?: string) =>
  api.get(`${base(userId)}/progress`, { query: { week }, schema: progressResponseSchema });

// ---- Trainees ----------------------------------------------------------------

export const fetchTrainees = (q: string, ptAdminId?: number) =>
  api.get("/v1/trainees", {
    query: { q: q.trim() || undefined, ptAdminId },
    schema: traineeListResponseSchema,
  });

export const fetchTrainee = (userId: number) =>
  api.get(base(userId), { schema: traineeDetailSchema });

export const createTrainee = (body: { name: string; email: string; ptAdminId?: number | null }) =>
  api.post("/v1/trainees", { body, schema: traineeCredentialsResponseSchema });

export const deleteTrainee = (userId: number) => api.delete(base(userId));

export const changeTraineeEmail = (userId: number, email: string) =>
  api.patch(`${base(userId)}/email`, { body: { email } });

export const resetTraineePassword = (userId: number) =>
  api.post(`${base(userId)}/password-reset`, { schema: passwordResetResponseSchema });

export const assignTraineePt = (userId: number, ptAdminId: number | null) =>
  api.put(`${base(userId)}/pt`, { body: { ptAdminId } });

export const setChatEnabled = (userId: number, enabled: boolean) =>
  api.put(`/v1/chat/trainees/${userId}/enabled`, {
    body: { enabled },
    schema: chatEnabledResponseSchema,
  });

export const fetchRestriction = (userId: number) =>
  api.get(`${base(userId)}/restriction`, { schema: traineeRestrictionResponseSchema });

export const saveRestriction = (
  userId: number,
  body: { level: "restricted" | "suspended"; duration: "24h" | "7d" | "30d" | "permanent"; reason: string },
) => api.put(`${base(userId)}/restriction`, { body });

export const liftRestriction = (userId: number) => api.delete(`${base(userId)}/restriction`);

// ---- Workout planning --------------------------------------------------------

export const fetchWorkoutWeek = (userId: number, from: string, to: string) =>
  api.get(`${base(userId)}/workout-days`, { query: { from, to }, schema: scheduleResponseSchema });

export const fetchWorkoutCopyInfo = (userId: number, from: string, to: string) =>
  api.get(`${base(userId)}/workout-days/copy-info`, {
    query: { from, to },
    schema: copyInfoResponseSchema,
  });

export const saveWorkoutDay = (userId: number, date: string, body: { title: string; note: string }) =>
  api.put(`${base(userId)}/workout-days/${date}`, { body, schema: workoutDayResponseSchema });

export type ExercisePayload = {
  title: string;
  youtubeUrl: string;
  sets: number | null;
  reps: string;
  description: string;
  confirmResetSets: boolean;
};

export const addExercise = (userId: number, date: string, body: ExercisePayload) =>
  api.post(`${base(userId)}/workout-days/${date}/exercises`, {
    body,
    schema: exerciseResponseSchema,
  });

export const updateExercise = (userId: number, exerciseId: number, body: ExercisePayload) =>
  api.put(`${base(userId)}/exercises/${exerciseId}`, { body, schema: exerciseResponseSchema });

export const deleteExercise = (userId: number, exerciseId: number, confirmDeleteSets: boolean) =>
  api.delete(`${base(userId)}/exercises/${exerciseId}`, {
    query: { confirmDeleteSets: confirmDeleteSets ? "true" : undefined },
  });

export const moveExercise = (userId: number, exerciseId: number, direction: "up" | "down") =>
  api.post(`${base(userId)}/exercises/${exerciseId}/move`, { body: { direction } });

export const copyWorkoutWeek = (
  userId: number,
  body: { fromWeek: string; targetUserId: number; targetDate: string },
) => api.post(`${base(userId)}/workout-days/copy-week`, { body, schema: copyWeekResponseSchema });

export const copyWorkoutDay = (userId: number, body: { date: string; dates: string[] }) =>
  api.post(`${base(userId)}/workout-days/copy-day`, { body, schema: copyDayResponseSchema });

// ---- Nutrition and meal plans --------------------------------------------------

export const fetchNutrition = (userId: number, week?: string) =>
  api.get(`${base(userId)}/nutrition`, { query: { week }, schema: nutritionOverviewResponseSchema });

// The target and the body profile take strings (decimal comma allowed).
export const saveNutritionTarget = (
  userId: number,
  body: { carbs: string; protein: string; fat: string; note: string },
) => api.put(`${base(userId)}/nutrition-target`, { body, schema: nutritionTargetResponseSchema });

export type BodyProfilePayload = {
  sex: "male" | "female";
  age: string;
  heightCm: string;
  weightKg: string;
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  kcalAdjustment: string;
  proteinPerKg: string;
  applyToTarget: boolean;
};

export const saveBodyProfile = (userId: number, body: BodyProfilePayload) =>
  api.put(`${base(userId)}/body-profile`, { body, schema: saveBodyProfileResponseSchema });

export const fetchMealPlanWeek = (userId: number, week?: string) =>
  api.get(`${base(userId)}/meal-plan-days`, {
    query: { week },
    schema: traineeMealPlanWeekResponseSchema,
  });

export const fetchMealPlanCopyInfo = (userId: number, from: string, to: string) =>
  api.get(`${base(userId)}/meal-plan-days/copy-info`, {
    query: { from, to },
    schema: mealPlanCopyInfoResponseSchema,
  });

export const createMealPlanDay = (userId: number, date: string) =>
  api.post(`${base(userId)}/meal-plan-days`, { body: { date }, schema: planDayResponseSchema });

export const copyMealPlanDay = (userId: number, dayId: number, dates: string[]) =>
  api.post(`${base(userId)}/meal-plan-days/copy`, {
    body: { dayId, dates },
    schema: copyPlanResultResponseSchema,
  });

export const applyLastWeek = (userId: number, weekStart: string) =>
  api.post(`${base(userId)}/meal-plan-days/apply-last-week`, {
    body: { weekStart },
    schema: copyPlanResultResponseSchema,
  });

export const deleteMealPlanDay = (dayId: number) => api.delete(`/v1/meal-plan-days/${dayId}`);

export const addMeal = (dayId: number) =>
  api.post(`/v1/meal-plan-days/${dayId}/meals`, { schema: planDayResponseSchema });

export const reorderMeals = (dayId: number, mealIds: number[]) =>
  api.put(`/v1/meal-plan-days/${dayId}/meals/order`, {
    body: { mealIds },
    schema: planDayResponseSchema,
  });

export const setMealShares = (
  dayId: number,
  shares: { mealId: number; percent: number }[] | null,
) =>
  api.put(`/v1/meal-plan-days/${dayId}/meals/shares`, {
    body: { shares },
    schema: planDayResponseSchema,
  });

export const removeMeal = (mealId: number) =>
  api.delete(`/v1/meals/${mealId}`, { schema: planDayResponseSchema });

export const renameMeal = (mealId: number, name: string) =>
  api.patch(`/v1/meals/${mealId}`, { body: { name }, schema: planDayResponseSchema });

export const addMealItem = (mealId: number, foodId: number, grams?: number) =>
  api.post(`/v1/meals/${mealId}/items`, { body: { foodId, grams }, schema: planDayResponseSchema });

export const autoSolveMeal = (mealId: number, fixedItemIds: number[]) =>
  api.post(`/v1/meals/${mealId}/auto-solve`, {
    body: { fixedItemIds },
    schema: planDayResponseSchema,
  });

export const removeMealItem = (itemId: number) =>
  api.delete(`/v1/meal-items/${itemId}`, { schema: planDayResponseSchema });

export const updateMealItemGrams = (itemId: number, grams: number) =>
  api.patch(`/v1/meal-items/${itemId}`, { body: { grams }, schema: planDayResponseSchema });

// ---- Food library ------------------------------------------------------------

export const fetchFoods = (params: { q?: string; group?: string; cursor?: string | null }) =>
  api.get("/v1/foods", {
    query: {
      q: params.q?.trim() || undefined,
      group: params.group,
      cursor: params.cursor ?? undefined,
      limit: 50,
    },
    schema: foodListResponseSchema,
  });

export const fetchFoodGroups = () => api.get("/v1/foods/groups", { schema: foodGroupsResponseSchema });

export const fetchFood = (id: number) => api.get(`/v1/foods/${id}`, { schema: foodResponseSchema });

export type FoodPayload = {
  name: string;
  group: string;
  state?: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber?: string;
  servingLabel?: string;
  servingGrams?: string;
  nameEn?: string;
  nameZh?: string;
  source?: string;
  confirmed?: boolean;
};

export const createFood = (body: FoodPayload) =>
  api.post("/v1/foods", { body, schema: foodResponseSchema });

export const updateFood = (id: number, body: FoodPayload) =>
  api.patch(`/v1/foods/${id}`, { body, schema: foodResponseSchema });

export const archiveFood = (id: number) => api.delete(`/v1/foods/${id}`);

// ---- PTs (super admin) -------------------------------------------------------

export const fetchPts = () => api.get("/v1/pts", { schema: adminAccountListResponseSchema });

export const createPt = (body: { username: string; password: string }) =>
  api.post("/v1/pts", { body, schema: adminAccountSchema });

export const setPtVerified = (adminId: number, verified: boolean) =>
  api.put(`/v1/admins/${adminId}/verified`, { body: { verified } });

// ---- Admin me ----------------------------------------------------------------

export const fetchAdminProfile = () =>
  api.get("/v1/admins/me", { schema: adminProfileResponseSchema });

export const setAdminAvatar = (dataUrl: string) =>
  api.put("/v1/admins/me/avatar", { body: { dataUrl }, schema: avatarResponseSchema });

export const removeAdminAvatar = () =>
  api.delete("/v1/admins/me/avatar", { schema: avatarResponseSchema });

export const setAdminChatColor = (color: string | null) =>
  api.put("/v1/admins/me/chat-color", { body: { color }, schema: chatColorResponseSchema });

export const setPresenceHidden = (isHidden: boolean) =>
  api.put("/v1/admins/me/presence-hidden", {
    body: { isHidden },
    schema: presenceHiddenResponseSchema,
  });

// ---- Passcode ----------------------------------------------------------------

export const setPasscode = (passcode: string) =>
  api.put("/v1/admins/me/passcode", { body: { passcode }, schema: passcodeStatusResponseSchema });

export const changePasscode = (currentPasscode: string, newPasscode: string) =>
  api.post("/v1/admins/me/passcode/change", {
    body: { currentPasscode, newPasscode },
    schema: passcodeStatusResponseSchema,
  });

export const removePasscode = (currentPasscode: string) =>
  api.delete("/v1/admins/me/passcode", {
    body: { currentPasscode },
    schema: passcodeStatusResponseSchema,
  });

export const verifyPasscode = (passcode: string) =>
  api.post("/v1/admins/me/passcode/verify", {
    body: { passcode },
    schema: passcodeStatusResponseSchema,
  });

export const resetPasscode = (password: string, newPasscode: string) =>
  api.post("/v1/admins/me/passcode/reset", {
    body: { password, newPasscode },
    schema: passcodeStatusResponseSchema,
  });

export const lockNow = () =>
  api.post("/v1/admins/me/passcode/lock", { schema: passcodeStatusResponseSchema });

export const revealHiddenUsers = (passcode: string) =>
  api.post("/v1/admins/me/hidden-users/reveal", {
    body: { passcode },
    schema: revealHiddenUsersResponseSchema,
  });

// ---- Hidden trainees ---------------------------------------------------------

export const fetchHiddenUsers = () =>
  api.get("/v1/admins/me/hidden-users", { schema: hiddenUsersResponseSchema });

export const hideUsers = (userIds: number[]) =>
  api.post("/v1/admins/me/hidden-users", { body: { userIds }, schema: hideUsersResponseSchema });

export const unhideUser = (userId: number) => api.delete(`/v1/admins/me/hidden-users/${userId}`);

// ---- Trainee-to-trainee chats (super admin, read-only) ---------------------------

export const fetchAdminDmList = () =>
  api.get("/v1/admin/dm/conversations", { schema: dmAdminListResponseSchema });

