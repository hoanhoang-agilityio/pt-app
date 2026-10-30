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

Round 1 answered 2026-10-30 by Hoan: "approve hết bỏ lưu ảnh" (all recommendations accepted except photos), plus an admin view to add, edit and delete foods, and groups that include prepared dishes.

| #   | Question                         | Decision                                                                                                                                                      |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Who edits the library, who sees? | One shared library; admins add, edit, delete; trainees browse read-only                                                                                       |
| Q2  | What does a food store?          | Name, group, state (raw/cooked, empty for prepared dishes), per 100 g: kcal, protein, carbs, fat, fiber (optional); optional serving ("1 tô" = 500 g); source |
| Q3  | Keeping the numbers right        | Keep the source kcal; the form compares it with 4/4/9 from the macros and refuses a gap above 10 % unless the PT ticks "Tôi đã kiểm tra số liệu"              |
| Q4  | Starter data                     | Seed about 60 common foods from USDA FoodData Central (FDC id kept as source); Vietnamese dishes are added by the PT                                          |
| Q5  | Photos                           | **No photos** (Hoan). Each group has an icon and colour instead                                                                                               |
| Q6  | Visual                           | Card list: group icon, name, kcal/100 g, bar of % kcal from P/C/F; detail with a grams or servings input showing P/C/F/kcal live                              |
| Q7  | Delete                           | The admin "Xóa" button archives the food (hidden everywhere, row kept) so later meal plans keep their numbers                                                 |
| Q8  | Groups                           | Thịt, Cá & hải sản, Trứng & sữa, Tinh bột, Rau, Trái cây, Đậu & hạt, Dầu & chất béo, Món chế biến (phở, bún, cơm tấm...), Khác                                |

Assumed: name search ignores Vietnamese accents; a name is unique among active foods ("Ức gà (sống)" and "Ức gà (chín)" are two foods); prepared dishes are stored per 100 g like everything else, with a serving such as "1 tô phở" = 500 g so the PT can think in bowls.

## Out of scope

- Meal plan calculator, target weight and timeline (next story, uses this library).
- Linking `food_entries` to library foods.
- AI features.

## Test matrix

| ID  | Case                                                                  | Expected                                            | Where         |
| --- | --------------------------------------------------------------------- | --------------------------------------------------- | ------------- |
| F1  | 150 g of chicken breast cooked (165 kcal, P 31, C 0, F 3.6 per 100 g) | 248 kcal, P 46.5, C 0, F 5.4                        | unit          |
| F2  | 1.5 servings of a 500 g bowl                                          | Same as 750 g                                       | unit          |
| F3  | kcal 165 vs macros 31/0/3.6 (156.4 kcal)                              | Gap 5.2 %, accepted                                 | unit          |
| F4  | kcal 65 vs macros 31/0/3.6                                            | Gap above 10 %, refused unless confirmed            | unit + e2e    |
| F5  | Macro split bar                                                       | % kcal from P, C, F sums to 100 and uses 4/4/9      | unit          |
| F6  | Bad input: negative, empty name, macros above 100 g per 100 g         | Field error in Vietnamese, nothing saved            | unit (Zod)    |
| F7  | Duplicate name among active foods                                     | Refused with a message                              | unit + e2e    |
| F8  | Admin adds, edits, deletes "Phở bò"                                   | Appears, changes, disappears from both lists        | e2e           |
| F9  | Trainee opens the library                                             | Sees cards and detail, no add/edit/delete controls  | e2e           |
| F10 | Non-admin calls a food action                                         | Refused by `requireAdmin()`                         | unit          |
| F11 | Search "uc ga" and filter by group                                    | Finds "Ức gà (chín)"; group filter narrows the list | unit + e2e    |
| F12 | Seed run twice                                                        | Second run inserts nothing                          | unit          |
| F13 | 390 px phone                                                          | List, detail and form fit with no horizontal scroll | browser-proof |
