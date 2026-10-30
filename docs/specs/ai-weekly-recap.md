# AI weekly recap (KAN-65)

Spec for the PT-facing weekly recap built on the Claude API. Intent: `intent/2026-10-30-ai-weekly-recap.md`. Plan: `docs/specs/ai-weekly-recap.plan.md`.

## Goal

The PT gets a short Vietnamese reading of one trainee's week and two or three suggestions for next week, from one button on the Summary tab.

## Facts from the repo (not decisions)

- `app/admin/(protected)/users/[id]/summary/page.tsx` already loads everything the recap needs for the selected week: `getWeekSchedule`, `getNutritionWeek`, `getWeightTrend`, `getTodayWeight`, `getExerciseProgress`.
- Admin pages call `requireAdmin()`; actions wrap errors with `withResultErrorHandling` in `services/action-errors.ts`.
- Env access lives in `services/env.ts`; optional vars are read with `readEnv()`.
- Unit tests run in CI on every PR (`pnpm verify`), so they must not need a key or network.

## Decisions (recommended, waiting for Hoan)

| #   | Question                         | Recommended                                                                                                                         | Decision |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q1  | Who sees it?                     | Admins only, on the member Summary tab                                                                                              | Pending  |
| Q2  | When is the API called?          | Only when the PT presses "Tóm tắt tuần bằng AI"; never on page load, never on a schedule                                            | Pending  |
| Q3  | Which model?                     | `claude-haiku-5-5` (cheap, fast, enough for a recap); model id in one constant so it is easy to switch                              | Pending  |
| Q4  | What data goes to the API?       | Only the week's numbers as JSON facts (days, completion, best sets vs previous best, macros vs target, weight start/end); no name   | Pending  |
| Q5  | Output shape?                    | JSON `{ summary: string, highlights: string[], suggestions: string[] }`, validated with Zod; invalid output shows a generic error   | Pending  |
| Q6  | Store the recap?                 | No in v1; pressing again regenerates. Avoids a schema change                                                                        | Pending  |
| Q7  | No key configured?               | Card not rendered at all                                                                                                            | Pending  |
| Q8  | Limits?                          | `max_tokens` 800, 20 s timeout, one request in flight per click (button disabled while loading)                                     | Pending  |
| Q9  | How do we know the prompt works? | A manual eval script with 5 fixture weeks and code-based checks (Vietnamese, mentions the right numbers, 2-3 suggestions, no names) | Pending  |

## Prompt design

- System prompt (cacheable, same for every call): role "trợ lý cho huấn luyện viên cá nhân", answer in Vietnamese, only use the facts given, never invent numbers, never give medical advice, JSON only.
- User message: the facts wrapped in `<week_facts>` XML tags, plus the rules for suggestions.
- Two short examples in the system prompt (one strong week, one weak week) to fix the tone and length.

## Test matrix

| ID  | Case                                      | Expected                                                      | Where                                   |
| --- | ----------------------------------------- | ------------------------------------------------------------- | --------------------------------------- |
| R1  | No `ANTHROPIC_API_KEY`                    | Card not rendered; `getAnthropicConfig()` returns null        | unit                                    |
| R2  | Week with no workouts and no food         | Facts say empty; action still answers (no crash)              | unit (`buildWeekFacts`)                 |
| R3  | Facts never contain the trainee's name    | No `name` field in the payload                                | unit                                    |
| R4  | Model returns valid JSON                  | Action returns `{ ok: true, recap }`                          | unit, SDK mocked                        |
| R5  | Model returns invalid JSON or wrong shape | Action returns the generic error with a reference id          | unit, SDK mocked                        |
| R6  | API error or timeout                      | Generic error with a reference id; logged by `logger`         | unit, SDK mocked                        |
| R7  | Non-admin calls the action                | Refused by `requireAdmin()`                                   | unit                                    |
| R8  | Fixture weeks                             | Eval script passes all code-based checks                      | `scripts/eval-weekly-recap.ts` (manual) |
| R9  | 390 px phone                              | Button, loading state and recap fit without horizontal scroll | browser-proof                           |

## Open questions

Asked on KAN-65; answers will be copied into the Decision column above.
