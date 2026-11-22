import {
  type FoodResponse,
  KCAL_PER_GRAM,
  kcalFromMacros,
  type MealLogResponse,
  type MealMarkResponse,
  type PlanDayResponse,
} from "@pt/contracts";

// Pure nutrition maths for the trainee screens, ported from the web
// (features/nutrition/utils, features/meal-plans/utils). Calories always
// follow from the macros (4/4/9). No React Native imports.

export type Macros = { carbs: number; protein: number; fat: number };
export type LogNutrition = Macros & { kcal: number };
export type Macro = keyof Macros;

export const MACROS: Macro[] = ["carbs", "protein", "fat"];

const EMPTY_LOG: LogNutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export const kcalOf = (macros: Macros) => kcalFromMacros(macros);

export const macrosOf = (food: Macros, grams: number): Macros => ({
  carbs: (food.carbs * grams) / 100,
  protein: (food.protein * grams) / 100,
  fat: (food.fat * grams) / 100,
});

export const nutritionOfFood = (food: Macros, grams: number): LogNutrition => {
  const macros = macrosOf(food, grams);

  return { ...macros, kcal: kcalOf(macros) };
};

export const sumLogNutrition = (parts: (LogNutrition | null)[]): LogNutrition =>
  parts.reduce<LogNutrition>(
    (sum, part) =>
      part
        ? {
            kcal: sum.kcal + part.kcal,
            protein: sum.protein + part.protein,
            carbs: sum.carbs + part.carbs,
            fat: sum.fat + part.fat,
          }
        : sum,
    EMPTY_LOG,
  );

type CountedItem = { foodId: number; grams: number; food: Macros | null };
type CountedLog = { foodId: number | null; nutrition: LogNutrition | null };
type FrozenItem = { foodId: number; nutrition: LogNutrition };

// What counts as eaten in one planned meal: the logs; when the meal is marked
// "Dat", every planned item (frozen numbers when present) except foods the
// trainee also logged, plus all logs on top.
export const listMealNutrition = (
  items: CountedItem[],
  logs: CountedLog[],
  isAchieved: boolean,
  frozen: FrozenItem[] = [],
): (LogNutrition | null)[] => {
  const parts = logs.map((log) => log.nutrition);

  if (!isAchieved) {
    return parts;
  }
  const loggedFoodIds = new Set(logs.map((log) => log.foodId));
  const unlogged = frozen.length
    ? frozen
        .filter((item) => !loggedFoodIds.has(item.foodId))
        .map((item) => item.nutrition)
    : items
        .filter((item) => !loggedFoodIds.has(item.foodId))
        .map((item) =>
          item.food ? nutritionOfFood(item.food, item.grams) : null,
        );

  return [...unlogged, ...parts];
};

export const countMealNutrition = (
  items: CountedItem[],
  logs: CountedLog[],
  isAchieved: boolean,
  frozen: FrozenItem[] = [],
) => sumLogNutrition(listMealNutrition(items, logs, isAchieved, frozen));

// ---- Targets ---------------------------------------------------------------

export const ON_TARGET = { kcalDiff: 80, proteinUnder: 5, carbsFat: 10 } as const;

export type ComparedMetric = "kcal" | Macro;
export type Comparison = {
  status: "none" | "under" | "over" | "on";
  difference: number;
  percent: number;
};

const RANGE: Record<ComparedMetric, { below: number; above: number }> = {
  kcal: { below: ON_TARGET.kcalDiff, above: ON_TARGET.kcalDiff },
  protein: { below: ON_TARGET.proteinUnder, above: Infinity },
  carbs: { below: ON_TARGET.carbsFat, above: ON_TARGET.carbsFat },
  fat: { below: ON_TARGET.carbsFat, above: ON_TARGET.carbsFat },
};

export const percentOf = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

export const compareToTarget = (
  actual: number,
  target: number | undefined,
  metric: ComparedMetric,
): Comparison => {
  if (!target) {
    return { status: "none", difference: 0, percent: 0 };
  }
  const percent = percentOf(actual, target);
  const { below, above } = RANGE[metric];

  if (actual < target - below) {
    return { status: "under", difference: target - actual, percent };
  }
  if (actual > target + above) {
    return { status: "over", difference: actual - target, percent };
  }
  return { status: "on", difference: Math.abs(actual - target), percent };
};

// Share of the target eaten, 0-100 for a bar; 0 without a target.
export const ringPercent = (eaten: number, target?: number) => {
  if (!target || target <= 0 || !Number.isFinite(eaten) || eaten <= 0) {
    return 0;
  }
  return Math.min(100, Math.round(percentOf(eaten, target)));
};

// ---- Meal split ------------------------------------------------------------

const SHARE_TOTAL = 100;

const splitWhole = (total: number, shares: number[]) => {
  const exact = shares.map((share) => (total * share) / SHARE_TOTAL);
  const floors = exact.map(Math.floor);
  let missing = Math.round(total) - floors.reduce((sum, v) => sum + v, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of byRemainder) {
    if (missing <= 0) {
      break;
    }
    floors[index] += 1;
    missing -= 1;
  }
  return floors;
};

// Splits the day's macro target across meals: all-null shares = equal split.
// Returns null when the shares are inconsistent.
export const splitDayTarget = (
  target: Macros,
  shares: (number | null)[],
): LogNutrition[] | null => {
  if (shares.length === 0) {
    return [];
  }
  const isEqual = shares.every((share) => share === null);

  if (!isEqual && shares.some((share) => share === null)) {
    return null;
  }
  const percents = isEqual
    ? shares.map(() => SHARE_TOTAL / shares.length)
    : (shares as number[]);

  if (percents.some((percent) => !Number.isFinite(percent) || percent <= 0)) {
    return null;
  }
  if (Math.abs(percents.reduce((sum, v) => sum + v, 0) - SHARE_TOTAL) > 1e-6) {
    return null;
  }
  const perMacro = Object.fromEntries(
    MACROS.map((macro) => [macro, splitWhole(target[macro], percents)]),
  ) as Record<Macro, number[]>;

  return percents.map((_, index) => {
    const macros = {
      carbs: perMacro.carbs[index],
      protein: perMacro.protein[index],
      fat: perMacro.fat[index],
    };

    return { ...macros, kcal: kcalOf(macros) };
  });
};

// ---- Formatting and names --------------------------------------------------

export const formatGrams = (grams: number, locale: string = "vi") => {
  const text = String(Math.round(grams * 10) / 10);

  return locale === "vi" ? text.replace(".", ",") : text;
};

export const formatKcal = (kcal: number) => String(Math.round(kcal));

// "330 kcal · P 62 · C 0 · F 7,2"
export const formatNutrition = (n: LogNutrition, locale: string = "vi") =>
  `${formatKcal(n.kcal)} kcal · P ${formatGrams(n.protein, locale)} · C ${formatGrams(n.carbs, locale)} · F ${formatGrams(n.fat, locale)}`;

type NamedFood = { name: string; nameEn?: string | null; nameZh?: string | null };

// vi shows the stored name; en/zh the translation, else the stored name.
export const localizeFoodName = (food: NamedFood, locale: string) => {
  if (locale === "en") {
    return food.nameEn?.trim() || food.name;
  }
  if (locale === "zh") {
    return food.nameZh?.trim() || food.name;
  }
  return food.name;
};

// Resolved numbers of a logged food (API: `nutrition`, null = nothing typed).
export const logNutritionOf = (log: MealLogResponse): LogNutrition | null =>
  log.nutrition;

export type MealView = {
  id: number;
  name: string;
  items: PlanDayResponse["meals"][number]["items"];
  logs: MealLogResponse[];
  mark: MealMarkResponse | null;
  planned: LogNutrition;
  eaten: LogNutrition;
  eatenCount: number;
};

// One planned meal with its logs, mark and the counted numbers.
export const buildMealView = (
  meal: PlanDayResponse["meals"][number],
  logs: MealLogResponse[],
  marks: MealMarkResponse[],
): MealView => {
  const mealLogs = logs.filter((log) => log.mealId === meal.id);
  const mark = marks.find((entry) => entry.mealId === meal.id) ?? null;
  const items = meal.items;
  const counted = listMealNutrition(
    items.map((item) => ({
      foodId: item.foodId,
      grams: item.grams,
      food: item.food,
    })),
    mealLogs.map((log) => ({ foodId: log.foodId, nutrition: log.nutrition })),
    mark?.achieved ?? false,
    mark?.frozen ?? [],
  );

  return {
    id: meal.id,
    name: meal.name,
    items,
    logs: mealLogs,
    mark,
    planned: sumLogNutrition(
      items.map((item) => nutritionOfFood(item.food, item.grams)),
    ),
    eaten: sumLogNutrition(counted),
    eatenCount: counted.length,
  };
};

// Grams of a food for `servings` servings; invalid counts as 0.
export const servingsToGrams = (servings: number, servingGrams: number) =>
  Number.isFinite(servings) && servings > 0 && servingGrams > 0
    ? servings * servingGrams
    : 0;

// Numbers of `grams` of a library food (per 100 g values).
export const scaleFood = (
  food: Pick<FoodResponse, "kcal" | "protein" | "carbs" | "fat">,
  grams: number,
): LogNutrition => {
  const factor = Number.isFinite(grams) && grams > 0 ? grams / 100 : 0;

  return {
    kcal: Math.round(food.kcal * factor),
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
  };
};

// An optional number typed in a form: empty = null, 0..max kept, else "invalid".
export const parseOptionalNumber = (
  text: string,
  max: number,
): number | null | "invalid" => {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }
  const value = /^(\d+[.,]?\d*|[.,]\d+)$/.test(trimmed)
    ? Number(trimmed.replace(",", "."))
    : Number.NaN;

  return Number.isFinite(value) && value >= 0 && value <= max ? value : "invalid";
};

export const MACRO_KCAL = KCAL_PER_GRAM;
