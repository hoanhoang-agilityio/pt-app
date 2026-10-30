# Plan: AI weekly recap

Status: waiting for Hoan's approval. No code before the plan is approved.

## Source

- Intent: `intent/2026-10-30-ai-weekly-recap.md`
- Spec: `docs/specs/ai-weekly-recap.md`
- KAN key: KAN-65 (sub-tasks KAN-66 [BE], KAN-67 [FE], KAN-68 [QA])

## Files that change

- `package.json`, `pnpm-lock.yaml`: add `@anthropic-ai/sdk`.
- `.env.example`: document optional `ANTHROPIC_API_KEY` (commented out).
- `services/env.ts`: `getAnthropicConfig()` returns `{ apiKey }` or `null`.
- `features/ai-recap/constants/recap.ts`: model id, `max_tokens`, timeout.
- `features/ai-recap/utils/week-facts.ts`: pure `buildWeekFacts()` from the data the Summary page already loads; no names.
- `features/ai-recap/utils/recap-prompt.ts`: system prompt, examples, `<week_facts>` user message.
- `features/ai-recap/services/recap-schemas.ts`: Zod schemas for the action input and the model output.
- `features/ai-recap/services/anthropic-client.ts`: `server-only` client factory (one place to mock in tests).
- `features/ai-recap/services/recap-actions.ts`: `generateWeeklyRecapAction({ userId, weekStart })`: `requireAdmin()`, Zod input, load data, build facts, call Claude with prompt caching on the system prompt, parse and validate JSON, wrapped in `withResultErrorHandling`.
- `features/ai-recap/components/WeeklyRecapCard/index.tsx`: client card with button, loading, result and error states.
- `app/admin/(protected)/users/[id]/summary/page.tsx`: render the card only when `getAnthropicConfig()` is not null.
- `scripts/eval-weekly-recap.ts` + `scripts/fixtures/recap-weeks.json`: manual prompt eval (not in CI).
- Tests: `features/ai-recap/utils/__tests__/week-facts.test.ts`, `features/ai-recap/services/__tests__/recap-actions.test.ts`, `services/__tests__/env.test.ts` (new case).

## Order of work

1. `getAnthropicConfig()` + `.env.example` + test R1 (KAN-66).
2. `buildWeekFacts()` + tests R2, R3 (KAN-66).
3. Prompt module and Zod output schema (KAN-66).
4. Server action with the client mocked in tests R4-R7 (KAN-66, KAN-68).
5. `WeeklyRecapCard` and the Summary page wiring (KAN-67).
6. Eval script with fixture weeks, run once by hand with a real key (KAN-68, R8).
7. Browser proof at 390 px on a local DB (KAN-68, R9), `pnpm verify`, PR.

## Risks

- **Cost:** contained by on-demand calls, a small model, `max_tokens` 800, and no calls from CI.
- **Privacy:** only numbers are sent, no names (R3). Anthropic does not train on API data by default; noted for the PT.
- **Wrong or invented numbers:** prompt says "only the facts given"; the eval checks that numbers in the recap exist in the facts; the page numbers stay the source of truth.
- **Vercel function timeout:** 20 s client timeout, below the default function limit.
- **Missing key in production:** card hidden, nothing else changes.

## Proof

- `pnpm verify` green (R1-R7 run without a key or network).
- `pnpm tsx --env-file-if-exists=.env.local scripts/eval-weekly-recap.ts` output pasted in the PR (R8).
- `browser-proof` report: button, loading, recap and error states at 390 px (R9).

## Deviations

None yet.
