# Plan: Meal plan builder

Status: approved by Hoan on 2026-10-30, split into three stories: KAN-70 (energy model), KAN-69 (meal plan builder), KAN-71 (trainee meal log).

## Source

- Spec and decisions: `docs/specs/meal-plan.md` (Q1-Q7, R1-R6, S1-S5, C1-C7)
- Builds on: food library (KAN-65, merged in PR #46)
- KAN key: KAN-69, proposed split into three stories below
- Workflow: dojo developer workflow (analyze, plan, fix, verify in the running app, PR, `/code-review`, human review, PR walkthrough artifact)

## Proposed split (one story per PR)

The decisions touch three areas. One PR for all of them would be about 3x the size of PR #46, so the plan ships them in order:

| Order | Story                      | What ships                                                                                                               |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1     | Energy model (KAN-70)      | C1, C2, C3, C7: Henry & Rees BMR, PT-set kcal adjustment, protein g/kg by sex, one on-target rule                        |
| 2     | Meal plan builder (KAN-69) | Q1-Q6, R1, R2, R5, S2, S5: per-day plans in the admin Dinh dưỡng tab, auto grams, copy days / last week, trainee request |
| 3     | Trainee meal log (KAN-71)  | R6, S4, C4, C5, S3: trainee sees the plan, logs what was eaten from the library, marks meals; weekly kcal notice         |

## Story 1: Energy model (KAN-70)

Files

- `db/schema.ts`: `body_profiles.kcal_adjustment` (integer, nullable) and `body_profiles.protein_per_kg` (real, nullable). Null keeps today's behaviour for existing members until the PT saves the profile, so no target changes silently on deploy.
- `features/nutrition/constants/energy.ts`: `HENRY_REES_1991` coefficients by sex and age band; `PROTEIN_PER_KG_DEFAULT` = male 2.0, female 1.6; `ON_TARGET` = kcal ±80, protein -5 g, carbs/fat ±10 g. `GOALS.calorieFactor` and `proteinPerKg` kept only as the fallback for null columns.
- `features/nutrition/utils/energy.ts`: `calculateBmr()` switches to Henry & Rees; `calculateEnergyPlan()` uses `kcal_adjustment` and `protein_per_kg`; goal label derived from the adjustment sign.
- `features/nutrition/utils/nutrition.ts`: `compareToTarget()` / `isDayOnTarget()` use `ON_TARGET` instead of `TARGET_TOLERANCE`.
- Body profile form: "Thâm hụt / dư kcal mỗi ngày" and "Đạm (g/kg)" fields with the defaults filled in.

Risks

- Henry & Rees (1991) coefficients, BMR in MJ/day (× 239 = kcal), W in kg, confirmed in a secondary source (Malaysian BMR validation paper, ResearchGate 225300932) because the original paper is not reachable from the cloud: men 18-30 `0.056W + 2.800`, 30-60 `0.046W + 3.160`; women 18-30 `0.048W + 2.562`, 30-60 `0.048W + 2.448`. The paper has no bands below 18 or above 60, so those ages keep Mifflin-St Jeor. Unit tests pin every band.
- Existing members' numbers change once the PT re-saves a profile (about 7 % lower BMR). The PT sees the new target before it applies.

## Story 2: Meal plan builder (KAN-69)

Schema (all new tables)

- `users`: `preferred_meal_count` (integer, nullable, 2-6), `food_note` (text, nullable) for the trainee's request (Q1).
- `meal_plan_days`: `id`, `user_id`, `date` (unique per user). A day with a plan; no plan names (R1).
- `meal_plan_meals`: `id`, `day_id`, `position`, `name`, `share_percent` (nullable; null = equal split, Q4).
- `meal_plan_items`: `id`, `meal_id`, `food_id` (references `foods`, archived foods still readable), `grams`.

Logic (pure, unit tested)

- `features/meal-plans/utils/meal-targets.ts`: split the day target across meals (equal or by %, total 100).
- `features/meal-plans/utils/solve-grams.ts`: for the foods chosen in a meal, find grams that hit the meal's P/C/F (non-negative least squares on the 3 macros, kcal follows), rounded to 5 g; returns the gap per macro (Q5, Q6). Worked example from the spec as a test: chicken, rice, 300 g broccoli give 427 g / 757 g and "Thiếu 36 g fat".
- `features/meal-plans/utils/plan-status.ts`: day status with the S2 + R5 rule.
- Suggestions for a gap: library foods of the group that fills it (fat: Dầu & chất béo, Đậu & hạt).

UI (admin Dinh dưỡng tab, S5)

- Week day tabs as today; each day shows its plan or "Chưa có plan" with "Tạo plan" and "Áp dụng tuần trước" (R2, never automatic).
- Meal list (defaults from the trainee's meal count, else 3; add, remove, rename, reorder; "Học viên muốn 4 bữa" when different).
- Per meal: search the food library, add foods, "Tính tự động", editable grams, totals vs meal target.
- "Sao chép sang ngày khác" to copy a day to chosen days.
- Trainee request fields on the trainee Dinh dưỡng page (Q1).

## Story 3: Trainee meal log (KAN-71)

- Trainee Dinh dưỡng page shows today's plan per meal, read-only (Q7).
- Per meal: "Đạt", or log what was eaten: search the library + amount, or a free name with optional macros; add, edit, remove (C5). New table `meal_logs` (`user_id`, `meal_id`, `food_id` nullable, `custom_name` nullable, `grams`, macros nullable) and `meal_marks` (`meal_id`, `achieved`, `note`).
- The free-text food log form is hidden; `food_entries` stays in the database and old entries still show in history (additive schema).
- Remove `describeFoodEquivalent` lines (C4).
- Weekly notice (S3): after a weigh-in the TDEE target already updates (`saveWeighIn`, unless manual). The admin Dinh dưỡng tab compares each planned day's kcal with the new target and shows "Plan lệch +120 kcal so với mục tiêu mới" when the gap is above 80 kcal.

## Proof (each story)

- Unit tests with hand-computed numbers for every formula (BMR bands, split, solver, status, notice).
- e2e for the main flow of each story at 390 px; browser proof screenshots.
- `pnpm verify` green, `/code-review`, PR walkthrough artifact.

## Deviations

None yet.
