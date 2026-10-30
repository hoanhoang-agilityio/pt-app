# Intent: Food library with macros, calories and images

- **Author:** Hoan
- **Status:** draft
- **KAN key:** KAN-65

## Problem

Members already get a TDEE and daily macro targets (protein, carbs, fat), but the app has no data about the foods they eat. The PT cannot turn "160 g protein, 235 g carbs, 55 g fat" into "how many grams of chicken breast, rice and broccoli", and trainees type food macros by hand when they log a meal.

## Proposed outcome

A food library the PT fills and trusts: each food has calories and protein, carbs, fat (and fiber) per 100 g, its state (raw or cooked), an optional serving size, a source, and a photo. The library is easy to scan visually (photo, calories, macro split) and shows exact macros for any amount. It is the base for the next feature: a meal plan calculator that picks the grams of each chosen food to hit a member's targets.

## Affected users and systems

- Admins (PTs): create, edit, archive foods; upload photos.
- Trainees: browse the library (read-only).
- New table `foods` (additive). Image storage (see spec).

## Constraints

- Additive schema only. Vietnamese UI copy. Mobile-first.
- Numbers must be right: the stored values come from a named source, and the app checks calories against the macros.
- No AI in this feature (Hoan, 2026-10-30).

## Open questions

Grill-me rounds in `docs/specs/food-library.md`, mirrored as comments on KAN-65.

## Out of scope

- Meal plan calculator and weight-goal targets (next story).
- Linking food log entries to library foods.
- AI suggestions.
