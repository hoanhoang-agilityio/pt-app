# Plan: Food library

Status: approved by Hoan on 2026-10-30 ("approve hết").

## Source

- Intent: `intent/2026-10-30-food-library.md`
- Spec: `docs/specs/food-library.md` (decisions Q1-Q8, test matrix F1-F13)
- KAN key: KAN-65 (KAN-66 [BE], KAN-67 [FE], KAN-68 [QA])
- Workflow: dojo developer workflow (analyze, plan, fix, verify in the app, PR, `/code-review`, human review, PR walkthrough artifact)

## Files that change

Schema and data

- `db/schema.ts`: new table `foods` (id, name, name_key, group, state nullable, kcal, protein, carbs, fat, fiber nullable, serving_label nullable, serving_grams nullable, source, archived_at nullable, created_at, updated_at). Index on `name_key`; uniqueness among active foods is checked in the action (SQLite partial unique index is not needed for v1).
- `features/foods/constants/foods.ts`: groups with label, lucide icon and colour; limits (max 100 g of a macro per 100 g, kcal 0-900, kcal gap 10 %).
- `features/foods/constants/seed-foods.ts`: about 60 foods with USDA FoodData Central values and FDC ids, checked against the FDC API when written.
- `scripts/seed-foods.ts` + `pnpm db:seed-foods`: inserts seed foods whose name is not there yet (idempotent). Called from `scripts/setup-database.ts` only when `foods` is empty, like the first admin.

Logic (pure, unit tested)

- `features/foods/utils/food-math.ts`: `scaleFood(food, grams)`, `servingsToGrams()`, `kcalFromMacros()`, `kcalGap()`, `macroSplit()` (percent of kcal), rounding for display (1 decimal for grams, whole kcal).
- `features/foods/utils/food-search.ts`: accent-insensitive match on name, group filter.
- `features/foods/services/food-schemas.ts`: Zod schema for the form, including the kcal-gap rule and the "Tôi đã kiểm tra số liệu" override.

Server

- `features/foods/services/food-queries.ts`: `listFoods({ includeArchived: false })`, `getFood(id)`.
- `features/foods/services/food-actions.ts`: `createFoodAction`, `updateFoodAction`, `archiveFoodAction`; each calls `requireAdmin()` first, validates with Zod, wraps errors with `withFormErrorHandling` / `withResultErrorHandling`, revalidates the food routes.

UI (mobile-first, Vietnamese copy)

- `features/foods/components/FoodCard`: group icon, name, state, kcal/100 g, macro split bar (reuses `MACRO_COLORS`).
- `features/foods/components/FoodList`: search box, group chips, cards; empty state.
- `features/foods/components/FoodAmountCalculator`: grams or servings input, live P/C/F/kcal.
- `features/foods/components/FoodForm` + `use-food-form.ts`: fields from Q2, live kcal-from-macros preview and gap warning, override checkbox.
- `features/foods/components/DeleteFoodButton`: confirm sheet ("Xóa món này?"), calls `archiveFoodAction`.
- `app/admin/(protected)/foods/page.tsx` (list + "Thêm món"), `foods/new/page.tsx`, `foods/[id]/page.tsx` (detail + edit + delete).
- `app/(user)/(protected)/foods/page.tsx` and `foods/[id]/page.tsx`: read-only list and detail.
- `constants/routes.ts`, `utils/routes.ts`: `ADMIN_FOODS`, `FOODS` and path helpers.
- Entry points: "Thực phẩm" button in the admin home header; "Thư viện thực phẩm" link on the trainee Dinh dưỡng page (the tab bar stays at three tabs).

Tests

- `features/foods/utils/__tests__/food-math.test.ts` (F1-F5), `food-search.test.ts` (F11), `features/foods/services/__tests__/food-schemas.test.ts` (F6), `food-actions.test.ts` (F7, F10), `scripts/__tests__/seed-foods.test.ts` (F12).
- `e2e/admin-foods.spec.ts` (F4, F7, F8, F11), `e2e/trainee-foods.spec.ts` (F9).

## Order of work

1. Schema (additive) + constants + `food-math` with tests F1-F5 (KAN-66).
2. Zod schema + search with tests F6, F11 (KAN-66).
3. Queries and actions with tests F7, F10 (KAN-66).
4. Seed data verified against FDC + seed script with test F12 (KAN-66).
5. Admin list, form, detail, delete (KAN-67).
6. Trainee list and detail, entry links (KAN-67).
7. e2e F4, F7-F9, F11; browser proof at 390 px (F13) (KAN-68).
8. `pnpm verify`, push, `/code-review`, PR walkthrough artifact, Hoan reviews.

## Risks

- **Wrong numbers:** values come from FDC with ids kept; the 4/4/9 check catches typos; unit tests use hand-computed cases.
- **Production data:** the build seeds `foods` only when the table is empty; it never updates or deletes rows. No script is run by hand against Turso.
- **Schema:** one new table only; nothing existing changes.
- **Deleted food used later:** archive keeps the row, so the meal plan story can still read it.

## Proof

- `pnpm verify` green, tail pasted in the PR.
- `pnpm test:e2e` for the two new specs.
- Browser proof report (admin add/edit/delete "Phở bò", kcal warning, trainee view) at 390 px.

## Deviations

Written while implementing (KAN-65).

- **Seed values not checked against the FDC API.** The sandbox proxy blocks `api.nal.usda.gov` (HTTP 403 on CONNECT), so the plan's "checked against the FDC API when written" could not be done. The values are USDA SR Legacy figures per 100 g typed from memory of the published tables. `source` holds `USDA SR Legacy, FDC <id>` only for the 16 foods whose FDC id is well known; the rest carry `USDA SR Legacy: <English description>` instead of a guessed id. Before the PR merges, someone with network access should re-check the seed against FDC and fill in the missing ids (`features/foods/constants/seed-foods.ts`).
- **Seed kcal gap.** 14 low-energy vegetables and fruits (broccoli, tomato, cucumber, spinach, lettuce, cabbage, mushroom, banana, apple, orange, mango, watermelon, papaya) sit more than 10 % from the 4/4/9 estimate because USDA's energy subtracts part of the fibre. They are kept as USDA lists them; the seed bypasses the form check, and `scripts/__tests__/seed-foods.test.ts` pins the exact list.
- **kcal upper limit 910, not 900.** Lard is 902 kcal per 100 g in USDA data, so a limit of 900 would reject a real food.
- **Group "Món chế biến" has no seed foods.** Q4 says Vietnamese dishes are added by the PT; the chip appears once a dish exists.
- **Delete confirm is `window.confirm`, not a sheet.** Same pattern as deleting a member or an exercise, and the e2e specs already handle dialogs that way.
- **Seed logic lives in `features/foods/services/seed-foods-service.ts`** (takes a database argument so the test can use an in-memory SQLite); `scripts/seed-foods.ts` and `setup-database.ts` call it. The test is still `scripts/__tests__/seed-foods.test.ts`.
- **`FoodList` takes `basePath`, not a `getHref` function**, because server pages cannot pass functions to a client component.
- **Extra files:** `db/__tests__/create-test-db.ts` (in-memory DB built from `db/schema.ts` for unit tests), `FoodLibraryLink` and `MacroSplitBar` components, hooks `use-food-filter`, `use-food-amount`; `/foods/:path*` added to the proxy matcher; the trainee tab bar keeps "Dinh dưỡng" active on `/foods`; `e2e/seed.ts` seeds four foods.
