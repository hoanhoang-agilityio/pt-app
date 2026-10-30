import {
  ACTIVITY_LEVELS,
  BMR_SEX_OFFSET,
  BODY_LIMITS,
  CALORIE_ROUNDING,
  FAT_CALORIE_SHARE,
  FOOD_EQUIVALENTS,
  GOALS,
  KCAL_ADJUSTMENT_LIMITS,
  KCAL_PER_GRAM,
  MACRO_ROUNDING_GRAMS,
  PROTEIN_PER_KG_LIMITS,
} from "@/features/nutrition/constants/energy";
import type {
  BodyProfile,
  EnergyPlan,
  Goal,
  Macro,
} from "@/features/nutrition/types/nutrition";
import {
  calculateCalories,
  formatLang,
} from "@/features/nutrition/utils/nutrition";
import { parseDecimal, parseSignedDecimal } from "@/utils/decimal";

const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;

export const getAge = (birthYear: number, today: string) =>
  Number(today.slice(0, 4)) - birthYear;

export const getBirthYear = (age: number, today: string) =>
  Number(today.slice(0, 4)) - age;

// Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + s.
export const calculateBmr = (
  { sex, weightKg, heightCm }: BodyProfile,
  age: number,
) => 10 * weightKg + 6.25 * heightCm - 5 * age + BMR_SEX_OFFSET[sex];

// The goal follows the sign of the PT's kcal adjustment: below zero cuts, zero
// maintains, above zero bulks. Null (not set yet) keeps the stored goal.
export const getGoalFromAdjustment = (kcalAdjustment: number): Goal => {
  if (kcalAdjustment < 0) {
    return "cut";
  }
  return kcalAdjustment > 0 ? "bulk" : "maintain";
};

export const getGoal = ({ kcalAdjustment, goal }: BodyProfile): Goal =>
  kcalAdjustment === null ? goal : getGoalFromAdjustment(kcalAdjustment);

export { calculateCalories };

// BMR (Mifflin-St Jeor) × activity = TDEE; the target is TDEE + the PT's kcal
// adjustment; protein is set per kg of body weight, fat to a share of
// calories, carbs fill the rest. A null adjustment or protein_per_kg falls back
// to the legacy goal values so existing members keep their numbers.
export const calculateEnergyPlan = (
  profile: BodyProfile,
  today: string,
): EnergyPlan => {
  const age = getAge(profile.birthYear, today);
  const bmr = calculateBmr(profile, age);
  const tdee = bmr * ACTIVITY_LEVELS[profile.activityLevel].factor;
  const legacy = GOALS[profile.goal];
  const targetCalories =
    profile.kcalAdjustment === null
      ? tdee * legacy.calorieFactor
      : tdee + profile.kcalAdjustment;
  const protein = roundTo(
    profile.weightKg * (profile.proteinPerKg ?? legacy.proteinPerKg),
    MACRO_ROUNDING_GRAMS,
  );
  const fat = roundTo(
    (targetCalories * FAT_CALORIE_SHARE) / KCAL_PER_GRAM.fat,
    MACRO_ROUNDING_GRAMS,
  );
  const remainingCalories =
    targetCalories - protein * KCAL_PER_GRAM.protein - fat * KCAL_PER_GRAM.fat;
  const carbs = Math.max(
    0,
    roundTo(remainingCalories / KCAL_PER_GRAM.carbs, MACRO_ROUNDING_GRAMS),
  );

  return {
    age,
    bmr: roundTo(bmr, CALORIE_ROUNDING),
    tdee: roundTo(tdee, CALORIE_ROUNDING),
    targetCalories: roundTo(targetCalories, CALORIE_ROUNDING),
    macros: { carbs, protein, fat },
  };
};

// The macro target pictured as food, weighed in lạng (100 g):
// 280 g carbs → "≈ 10 lạng cơm chín"; 56 g fat → "≈ 4 thìa dầu ăn".
export const describeFoodEquivalent = (macro: Macro, grams: number) => {
  const { food, gramsPerUnit, unit } = FOOD_EQUIVALENTS[macro];
  const amount = grams / gramsPerUnit;

  return unit === "g"
    ? `≈ ${formatLang(amount)} ${food}`
    : `≈ ${Math.round(amount)} ${unit} ${food}`;
};

export const formatCalories = (calories: number) =>
  `${Math.round(calories).toLocaleString("vi-VN")} kcal`;

export interface BodyProfileDraft {
  sex: BodyProfile["sex"];
  age: string;
  heightCm: string;
  weightKg: string;
  activityLevel: BodyProfile["activityLevel"];
  goal: BodyProfile["goal"];
  // Empty = not set (legacy goal values).
  kcalAdjustment: string;
  proteinPerKg: string;
}

const isBetween = (value: number, { min, max }: { min: number; max: number }) =>
  value >= min && value <= max;

// Live preview while the admin types; null until every number is plausible.
export const toBodyProfile = (
  draft: BodyProfileDraft,
  today: string,
): BodyProfile | null => {
  const age = parseDecimal(draft.age);
  const heightCm = parseDecimal(draft.heightCm);
  const weightKg = parseDecimal(draft.weightKg);
  const kcalText = draft.kcalAdjustment.trim();
  const proteinText = draft.proteinPerKg.trim();
  const kcalAdjustment = kcalText ? parseSignedDecimal(kcalText) : null;
  const proteinPerKg = proteinText ? parseDecimal(proteinText) : null;
  const isValid =
    Number.isInteger(age) &&
    isBetween(age, BODY_LIMITS.AGE) &&
    isBetween(heightCm, BODY_LIMITS.HEIGHT_CM) &&
    isBetween(weightKg, BODY_LIMITS.WEIGHT_KG) &&
    (kcalAdjustment === null ||
      (Number.isInteger(kcalAdjustment) &&
        isBetween(kcalAdjustment, KCAL_ADJUSTMENT_LIMITS))) &&
    (proteinPerKg === null || isBetween(proteinPerKg, PROTEIN_PER_KG_LIMITS));

  if (!isValid) {
    return null;
  }
  return {
    sex: draft.sex,
    birthYear: getBirthYear(age, today),
    heightCm,
    weightKg,
    activityLevel: draft.activityLevel,
    goal: draft.goal,
    kcalAdjustment,
    proteinPerKg,
  };
};

// 72.5 → "72,5" (Vietnamese decimal comma), 175 → "175".
export const formatDecimal = (value: number) =>
  value.toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
    useGrouping: false,
  });
