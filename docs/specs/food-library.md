# Food library (KAN-65)

Decision log from the `/grill-me` intake. Intent: `intent/2026-10-30-food-library.md`. The plan (`docs/specs/food-library.plan.md`) is written after the grill closes.

## Goal

The PT keeps a trusted library of foods with calories and macros per 100 g and a photo; anyone can see at a glance what a food is made of and get exact macros for any amount. "Done": the PT can add "Ức gà (chín)" with its numbers and photo in under a minute, and a trainee can open it and see that 150 g gives 46.5 g protein and 248 kcal.

## Facts from the repo (not decisions)

- `body_profiles` + `calculateEnergyPlan()` (`features/nutrition/utils/energy.ts`) already give TDEE, target calories and macro grams (protein per kg, fat 25 % of kcal, carbs fill the rest).
- `KCAL_PER_GRAM` = carbs 4, protein 4, fat 9 (`features/nutrition/constants/energy.ts`).
- `food_entries` stores free-text meals with optional macro grams; no food table exists.
- Macro colours `MACRO_COLORS` and labels `MACRO_LABELS` already exist for UI.
- Vercel has no writable disk; the Vercel build runs `drizzle-kit push` on production, so the schema must be additive.

## Worked example the library must support (next story)

Male, 72 kg, 175 cm, 30 y, moderate, goal cut: BMR 1,669, TDEE 2,587, target 2,070 kcal, macros P 160 / C 235 / F 55 g.
With chicken breast cooked (P 31, C 0, F 3.6 per 100 g), white rice cooked (P 2.7, C 28.2, F 0.3) and broccoli cooked fixed at 300 g (P 2.4, C 7.2, F 0.4): rice 757 g, chicken 427 g, fat only 18.8 g, so 36 g fat is missing and the calculator must say so (for example "add 36 g oil"). This is why every food needs exact per-100 g values and a category.

## Decisions

Round 1 sent 2026-10-30, waiting for Hoan.

| #   | Question                            | Recommended                                                                                                                                                  | Decision |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Q1  | Who edits the library, who sees it? | One shared library; admins create, edit, archive; trainees browse read-only                                                                                  | Pending  |
| Q2  | What does a food store?             | Name, category, state (raw/cooked), per 100 g: kcal, protein, carbs, fat, fiber (optional); optional serving ("1 quả trứng" = 50 g); source; photo           | Pending  |
| Q3  | How do we keep the numbers right?   | Store kcal as the source gives it; the form compares it with 4/4/9 from the macros and blocks saving if they differ by more than 10 % unless the PT confirms | Pending  |
| Q4  | Starter data?                       | Seed about 60 common foods from USDA FoodData Central (public domain, FDC id kept as source); Vietnamese dishes added by the PT from labels                  | Pending  |
| Q5  | Where do photos live?               | Upload to Vercel Blob (jpg/png/webp, at most 2 MB); without a photo, show the category icon. Needs `BLOB_READ_WRITE_TOKEN` on Vercel                         | Pending  |
| Q6  | What makes it "visual"?             | Grid of cards (photo, name, kcal/100 g, bar of % kcal from P/C/F); detail page with a grams or servings input that shows P/C/F/kcal live                     | Pending  |
| Q7  | Can a food be deleted?              | Archive only (hidden from lists), so future meal plans that use it keep working                                                                              | Pending  |

Assumed unless Hoan objects: categories Đạm, Tinh bột, Rau, Trái cây, Chất béo, Sữa, Khác; name search ignores Vietnamese accents; names are unique per state ("Ức gà (sống)" and "Ức gà (chín)" are two foods).

## Out of scope

- Meal plan calculator, target weight and timeline (next story, uses this library).
- Linking `food_entries` to library foods.
- AI features.

## Test matrix

Written after the grill closes.
