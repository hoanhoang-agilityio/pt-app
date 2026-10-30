import type {
  ActivityLevel,
  Goal,
  Macro,
  Sex,
} from "@/features/nutrition/types/nutrition";

export const SEX_LABELS: Record<Sex, string> = { male: "Nam", female: "Nữ" };

export const ACTIVITY_LEVELS: Record<
  ActivityLevel,
  { factor: number; label: string; description: string }
> = {
  sedentary: {
    factor: 1.2,
    label: "Ít vận động",
    description: "Ngồi nhiều, không tập",
  },
  light: { factor: 1.375, label: "Nhẹ", description: "Tập 1–3 buổi/tuần" },
  moderate: { factor: 1.55, label: "Vừa", description: "Tập 3–5 buổi/tuần" },
  active: { factor: 1.725, label: "Nhiều", description: "Tập 6–7 buổi/tuần" },
  very_active: {
    factor: 1.9,
    label: "Rất nhiều",
    description: "Tập 2 buổi/ngày hoặc lao động nặng",
  },
};

export const ACTIVITY_LEVEL_ORDER: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

// Legacy fallback only: calories relative to TDEE and protein per kg of body
// weight, per goal. Used while a member's kcal_adjustment / protein_per_kg are
// still null; once the PT saves the profile those two fields take over.
export const GOALS: Record<
  Goal,
  { label: string; calorieFactor: number; proteinPerKg: number }
> = {
  cut: { label: "Giảm mỡ", calorieFactor: 0.8, proteinPerKg: 2.2 },
  maintain: { label: "Giữ cân", calorieFactor: 1, proteinPerKg: 1.8 },
  bulk: { label: "Tăng cơ", calorieFactor: 1.1, proteinPerKg: 2 },
};

export const GOAL_ORDER: Goal[] = ["cut", "maintain", "bulk"];

// Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + s, s = +5 (male) / −161 (female).
export const BMR_SEX_OFFSET: Record<Sex, number> = { male: 5, female: -161 };

// Protein g per kg of body weight when the PT sets none: by sex.
export const PROTEIN_PER_KG_DEFAULT: Record<Sex, number> = {
  male: 2,
  female: 1.6,
};

export const PROTEIN_PER_KG_LIMITS = { min: 1, max: 3 } as const;

// Daily kcal added to (positive) or taken from (negative) the TDEE.
export const KCAL_ADJUSTMENT_LIMITS = { min: -1500, max: 1500 } as const;

// One rule for "on target", in grams except kcalDiff (kcal): kcal within
// ±kcalDiff of the target's kcal, protein no more than proteinUnder below
// target (above is fine), carbs and fat within ±carbsFat.
export const ON_TARGET = {
  kcalDiff: 80,
  proteinUnder: 5,
  carbsFat: 10,
} as const;

export const KCAL_PER_GRAM: Record<Macro, number> = {
  carbs: 4,
  protein: 4,
  fat: 9,
};

// Share of target calories that comes from fat; carbs fill the rest.
export const FAT_CALORIE_SHARE = 0.25;

export const MACRO_ROUNDING_GRAMS = 5;
export const CALORIE_ROUNDING = 10;

export const BODY_LIMITS = {
  AGE: { min: 12, max: 90 },
  HEIGHT_CM: { min: 120, max: 230 },
  WEIGHT_KG: { min: 30, max: 250 },
} as const;
