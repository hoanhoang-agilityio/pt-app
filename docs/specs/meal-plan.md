# Meal plan builder (KAN-69)

Decision log from the `/grill-me` intake. Depends on the food library (KAN-65, `docs/specs/food-library.md`). The plan is written after the grill closes and after KAN-65 ships.

## Goal

The PT builds a member's daily meal plan from the food library. The number of meals follows the trainee's request when there is one (for example 4 meals), otherwise the PT chooses, and the PT can always change it. Each meal holds foods and grams; the app shows protein, carbs, fat and kcal per meal and per day against the member's targets, and can solve the grams of the chosen foods so the day hits the targets, saying which macro is short.

## Facts from the repo (not decisions)

- Daily macro targets: `nutrition_targets` (per user, `effectiveFrom`, source `tdee` or `manual`), computed by `calculateEnergyPlan()` from `body_profiles`.
- Meals in the food log: `MEALS` = breakfast, lunch, dinner, snack (`features/nutrition/constants/nutrition.ts`); `food_entries.meal` uses that enum.
- Admin member pages: `/admin/users/[id]` (workouts), `/nutrition`, `/summary`, `/preview`.
- Worked example (spec of KAN-65): 72 kg male, cut, P 160 / C 235 / F 55 g; chicken, rice, 300 g broccoli give 427 g chicken, 757 g rice, and 36 g fat short.

## Decisions

Round 1 sent 2026-10-30, waiting for Hoan.

| #   | Question                                     | Recommended                                                                                                                                           | Decision |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q1  | Where does the trainee's request come from?  | On the trainee Dinh dưỡng page: "Số bữa mong muốn" (2-6) and an optional note (foods they like or avoid); the PT sees it on the member page           | Pending  |
| Q2  | How is the meal count set?                   | The plan starts with the trainee's count, else 3; the PT can add or remove meals at any time; when it differs, the page shows "Học viên muốn 4 bữa"   | Pending  |
| Q3  | Meal names?                                  | Defaults Bữa sáng, Bữa trưa, Bữa tối, then Bữa phụ 1, 2...; the PT can rename and reorder                                                             | Pending  |
| Q4  | How is the day target split across meals?    | Equal split by default; the PT can set a % per meal (must total 100 %)                                                                                | Pending  |
| Q5  | How are grams decided?                       | The PT picks foods per meal; "Tính tự động" solves the grams to hit the meal targets (deterministic, rounded to 5 g); the PT can edit any grams after | Pending  |
| Q6  | When targets cannot be met (e.g. fat short)? | Show the gap per macro ("Thiếu 36 g fat") and suggest library foods of the group that fills it (for fat: Dầu & chất béo, Đậu & hạt)                   | Pending  |
| Q7  | One plan or one per day? Who sees it?        | One active plan per member, same every day, with an effective-from date like targets (history kept); the trainee sees it read-only                    | Pending  |

Later rounds (after round 1): target weight and timeline (72 → 70 kg by a date) changing the calorie target, accepted tolerance (±5 % kcal, ±10 % per macro), logging a planned meal into the food log.

## Out of scope

- AI suggestions.
- Shopping lists, recipes.

## Test matrix

Written after the grill closes.
