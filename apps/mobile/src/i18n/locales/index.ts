import enAccount from "./en/account.json";
import enAdmin from "./en/admin.json";
import enNutrition from "./en/nutrition.json";
import enWorkouts from "./en/workouts.json";
import viAccount from "./vi/account.json";
import viAdmin from "./vi/admin.json";
import viNutrition from "./vi/nutrition.json";
import viWorkouts from "./vi/workouts.json";
import zhAccount from "./zh/account.json";
import zhAdmin from "./zh/admin.json";
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
  vi: [viWorkouts, viNutrition, viAccount, { admin: viAdmin }] as Tree[],
  en: [enWorkouts, enNutrition, enAccount, { admin: enAdmin }] as Tree[],
  zh: [zhWorkouts, zhNutrition, zhAccount, { admin: zhAdmin }] as Tree[],
};
