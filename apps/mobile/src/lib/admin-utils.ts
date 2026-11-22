import { addDays, getTodayDate, getWeekDates, getWeekStart } from "@pt/contracts";

// Pure helpers of the admin (PT / super admin) screens. No React Native
// imports so they run under Vitest.

export const today = () => {
  try {
    return getTodayDate();
  } catch {
    // A runtime without time zone support: fall back to the device date.
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
};

export const currentWeekStart = () => getWeekStart(today());

export const shiftWeek = (weekStart: string, weeks: number) => addDays(weekStart, weeks * 7);

export const weekDates = (weekStart: string) => getWeekDates(weekStart);

// A week as the `from` / `to` range of the workout day endpoints.
export const weekRange = (weekStart: string) => ({
  from: weekStart,
  to: addDays(weekStart, 6),
});

// "2026-11-22" -> "22/11"
export const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

// Index 0 = Monday (the week starts on Monday).
export const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

export type Role = "super_admin" | "pt";

export const canManageFoods = (role: Role) => role === "super_admin";
export const canAssignPt = (role: Role) => role === "super_admin";
export const canManagePts = (role: Role) => role === "super_admin";
export const canRestrict = (role: Role) => role === "super_admin";

// Trims and turns an empty string into null.
export const emptyToNull = (value: string) => {
  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
};

// "1,6" and "1.6" are the same number; anything else is NaN.
export const parseNumber = (value: string) => {
  const text = value.trim().replace(",", ".");

  return text !== "" && /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
};

export const roundTo = (value: number, digits = 0) => {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
};

export type ExerciseForm = {
  title: string;
  youtubeUrl: string;
  sets: string;
  reps: string;
  description: string;
};

// The PUT/POST body of an exercise. `sets` is a number or null; an invalid
// number is left to the API to refuse with its own message.
export const exerciseBody = (form: ExerciseForm, confirmResetSets: boolean) => {
  const sets = form.sets.trim() === "" ? null : Number(form.sets.trim());

  return {
    title: form.title,
    youtubeUrl: form.youtubeUrl,
    sets: sets !== null && Number.isFinite(sets) ? sets : null,
    reps: form.reps,
    description: form.description,
    confirmResetSets,
  };
};

type Per100 = { kcal: number; protein: number; carbs: number; fat: number };
type PlanItem = { grams: number; food: Per100 };
type PlanMeal = { items: PlanItem[] };

export type Totals = { kcal: number; protein: number; carbs: number; fat: number };

export const emptyTotals = (): Totals => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

// Nutrition of the planned items (food values are per 100 g).
export const mealTotals = (meal: PlanMeal): Totals =>
  meal.items.reduce<Totals>((sum, item) => {
    const factor = item.grams / 100;

    return {
      kcal: sum.kcal + item.food.kcal * factor,
      protein: sum.protein + item.food.protein * factor,
      carbs: sum.carbs + item.food.carbs * factor,
      fat: sum.fat + item.food.fat * factor,
    };
  }, emptyTotals());

export const dayTotals = (day: { meals: PlanMeal[] }): Totals =>
  day.meals.reduce<Totals>((sum, meal) => {
    const totals = mealTotals(meal);

    return {
      kcal: sum.kcal + totals.kcal,
      protein: sum.protein + totals.protein,
      carbs: sum.carbs + totals.carbs,
      fat: sum.fat + totals.fat,
    };
  }, emptyTotals());

// Equal split of 100 % over `count` meals, as whole numbers that add up to 100.
export const equalShares = (count: number) => {
  if (count <= 0) {
    return [];
  }
  const base = Math.floor(100 / count);
  const shares = Array.from({ length: count }, () => base);

  shares[shares.length - 1] += 100 - base * count;
  return shares;
};

export const sharesTotal = (values: string[]) =>
  values.reduce((sum, value) => {
    const parsed = parseNumber(value);

    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

// A 4-digit passcode typed so far.
export const isPasscode = (value: string, length = 4) =>
  new RegExp(`^\\d{${length}}$`).test(value);

// Which trainees match a free text search (accent and case insensitive).
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

// Moves `id` one step in `ids`; an edge is a no-op.
export const moveId = (ids: number[], id: number, direction: "up" | "down") => {
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || target < 0 || target >= ids.length) {
    return ids;
  }
  const next = [...ids];

  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

// Data URL for the avatar upload.
export const jpegDataUrl = (base64: string) => `data:image/jpeg;base64,${base64}`;
