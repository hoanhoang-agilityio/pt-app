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

Round 1 answered 2026-10-30 by Hoan: Q1-Q6 accepted; Q7 changed.

| #   | Question                                     | Recommended                                                                                                                                                     | Decision |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q1  | Where does the trainee's request come from?  | On the trainee Dinh dưỡng page: "Số bữa mong muốn" (2-6) and an optional note (foods they like or avoid); the PT sees it on the member page                     | Accepted |
| Q2  | How is the meal count set?                   | The plan starts with the trainee's count, else 3; the PT can add or remove meals at any time; when it differs, the page shows "Học viên muốn 4 bữa"             | Accepted |
| Q3  | Meal names?                                  | Defaults Bữa sáng, Bữa trưa, Bữa tối, then Bữa phụ 1, 2...; the PT can rename and reorder                                                                       | Accepted |
| Q4  | How is the day target split across meals?    | Equal split by default; the PT can set a % per meal (must total 100 %)                                                                                          | Accepted |
| Q5  | How are grams decided?                       | The PT picks foods per meal; "Tính tự động" solves the grams to hit the meal targets (deterministic, rounded to 5 g); the PT can edit any grams after           | Accepted |
| Q6  | When targets cannot be met (e.g. fat short)? | Show the gap per macro ("Thiếu 36 g fat") and suggest library foods of the group that fills it (for fat: Dầu & chất béo, Đậu & hạt)                             | Accepted |
| Q7  | One plan or one per day? Who sees it?        | Hoan: a plan can be applied to the whole week, or several plans can be used within one week (different days get different plans); the trainee sees it read-only | Changed  |

Round 2 answered 2026-10-30 by Hoan:

| #     | Decision (Hoan)                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1    | Plans have no names. The PT creates a plan and adds it to days of the member's existing week schedule                                                                                                   |
| R2    | A new week starts empty: the PT chooses "apply last week" or builds new; never applied automatically                                                                                                    |
| R3/R4 | The only goal is reaching the target weight with enough protein (g/kg body weight, by sex). A plan only has to hit the day's kcal and macros; the weekly weigh-in tells the PT whether kcal must change |
| R5    | A plan is on target when its kcal are within 80 kcal of the day target                                                                                                                                  |
| R6    | v1: the trainee marks a meal as achieved, or notes which food was short or over                                                                                                                         |

Round 3 answered 2026-10-30 by Hoan:

| #   | Decision                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Protein g/kg is set per member; defaults male 2.0, female 1.6                                                                                                                                                                                                                       |
| S2  | Besides ±80 kcal: protein no more than 5 g under target; carbs and fat within ±10 g                                                                                                                                                                                                 |
| S3  | The goal is a daily kcal deficit or surplus vs TDEE (for example -200). After each weekly weigh-in the app recomputes TDEE from the new weight; if the plan no longer gives the intended deficit (for example only -100), it tells the PT how many kcal to change. Same for gaining |
| S4  | The trainee marks each meal "Đạt" or notes per food what was short or over; the PT sees it on the member page                                                                                                                                                                       |
| S5  | The PT builds plans in the member's Dinh dưỡng tab, per day                                                                                                                                                                                                                         |

Fact noted with S3: with any weight-based BMR equation the TDEE moves only a few kcal per 0.5 kg (Mifflin-St Jeor: 5 kcal BMR, about 8 kcal TDEE at 1.55), so the notice usually fires after a few kg of change or when the profile changes.

Round 4: existing behaviour to change or remove (Hoan asked to revise anything the new feature makes obsolete). Answered 2026-10-30:

| #   | Today                                                       | Decision                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `GOALS.calorieFactor`: cut/maintain/bulk = TDEE × 0.8/1/1.1 | Replace with a PT-set daily kcal adjustment (S3); the goal label follows its sign. Column `goal` stays (additive schema) but is no longer used for maths                                                                     |
| C2  | `GOALS.proteinPerKg`: 2.2/1.8/2.0 g/kg by goal              | Replace with S1                                                                                                                                                                                                              |
| C3  | `TARGET_TOLERANCE`: every macro ±10 %                       | One rule everywhere (food log, week summary, meal plan): S2 + R5                                                                                                                                                             |
| C4  | `describeFoodEquivalent` ("≈ 10 lạng cơm chín")             | Remove when meal plans ship                                                                                                                                                                                                  |
| C5  | Free-text food log                                          | Replaced: the trainee logs what they ate inside the day's plan, per meal: search the food library (accent-free) + amount, then add/edit/remove; a food missing from the library can still be added by name (macros optional) |
| C6  | Manual macro targets typed by the PT                        | Kept as an override; plans are judged against the active target                                                                                                                                                              |
| C7  | BMR by Mifflin-St Jeor                                      | Replace with Henry & Rees (1991) equations for tropical populations (weight, sex, age band). See below                                                                                                                       |

C7 evidence (Hoan: "chọn công thức chính xác nhất cho người Việt Nam"): a National Institute of Nutrition (Hanoi) 2008 indirect-calorimetry study of Vietnamese adolescents (15-17) and older adults (60-70) found FAO/WHO/UNU 1985 overestimates RMR by 8-11 % and measured values close to Henry & Rees (1991) and the Japanese 1999 equation (https://viendinhduong.vn/en/lookup/de-tai-nghien-cuu-khoa-hoc/68035d08359ef722321fcdca). No equation is validated on Vietnamese adults 18-59, so Henry & Rees is the best available evidence. Coefficients must be checked against the original paper (Eur J Clin Nutr 1991;45:177-185) during implementation and pinned by unit tests.

Grill closed 2026-10-30. Next: `docs/specs/meal-plan.plan.md`.

## Out of scope

- AI suggestions.
- Plan names (R1).
- Shopping lists, recipes.

## Test matrix

Written after the grill closes.
