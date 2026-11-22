import enAccount from "./en/account.json";
import enAdmin from "./en/admin.json";
import enMessenger from "./en/messenger.json";
import enNutrition from "./en/nutrition.json";
import enSocial from "./en/social.json";
import enWorkouts from "./en/workouts.json";
import viAccount from "./vi/account.json";
import viAdmin from "./vi/admin.json";
import viMessenger from "./vi/messenger.json";
import viNutrition from "./vi/nutrition.json";
import viSocial from "./vi/social.json";
import viWorkouts from "./vi/workouts.json";
import zhAccount from "./zh/account.json";
import zhAdmin from "./zh/admin.json";
import zhMessenger from "./zh/messenger.json";
import zhNutrition from "./zh/nutrition.json";
import zhSocial from "./zh/social.json";
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
  vi: [viWorkouts, viNutrition, viAccount, { admin: viAdmin }, viSocial, viMessenger] as Tree[],
  en: [enWorkouts, enNutrition, enAccount, { admin: enAdmin }, enSocial, enMessenger] as Tree[],
  zh: [zhWorkouts, zhNutrition, zhAccount, { admin: zhAdmin }, zhSocial, zhMessenger] as Tree[],
};
