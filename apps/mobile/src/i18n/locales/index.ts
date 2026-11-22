import enAccount from "./en/account.json";
import enNutrition from "./en/nutrition.json";
import enWorkouts from "./en/workouts.json";
import viAccount from "./vi/account.json";
import viNutrition from "./vi/nutrition.json";
import viWorkouts from "./vi/workouts.json";
import zhAccount from "./zh/account.json";
import zhNutrition from "./zh/nutrition.json";
import zhWorkouts from "./zh/workouts.json";

// Per-feature message files (trainee workouts, nutrition, account). They are
// merged into the base vi/en/zh messages by i18n/index.ts.

type Tree = { [key: string]: string | Tree };

const isTree = (value: unknown): value is Tree =>
  typeof value === "object" && value !== null;

export const deepMerge = (base: Tree, ...extras: Tree[]): Tree => {
  const out: Tree = { ...base };

  for (const extra of extras) {
    for (const [key, value] of Object.entries(extra)) {
      const current = out[key];

      out[key] =
        isTree(current) && isTree(value) ? deepMerge(current, value) : value;
    }
  }
  return out;
};

export const featureMessages = {
  vi: [viWorkouts, viNutrition, viAccount] as Tree[],
  en: [enWorkouts, enNutrition, enAccount] as Tree[],
  zh: [zhWorkouts, zhNutrition, zhAccount] as Tree[],
};
