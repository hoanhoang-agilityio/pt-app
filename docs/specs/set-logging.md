# Set logging (capstone, dojo Day 12-15)

Decision log from the `/grill-me` intake. Source of truth for the KAN ticket pack; the Jira tickets link here.

## Goal

Trainees record what they actually lifted (weight and reps per set) while they train, see last time's numbers so they stop guessing, and feel rewarded when they beat their old best. The PT sees who is getting stronger.

"Done" for the client: a trainee can log a set in a few taps on a phone between sets, and the PT can tell from the member page whether a trainee is progressing.

## Facts from the repo (not decisions)

- `exercises` is one row per exercise per day (`db/schema.ts`); each week gets new rows. `sets` is a nullable integer, `reps` is free text (e.g. `12`, `8-12`, `30s`), `youtubeId` is required.
- `exercise_completions` holds at most one row per exercise (unique `exerciseId`) with `completedAt`; cascade-deleted with the exercise.
- Completion toggle (`features/workouts/services/completion-actions.ts`): `requireUser()`, refuses future dates (Asia/Ho_Chi_Minh), insert to mark, delete to un-mark.
- Copy week (`copyWeekAction` in `features/workouts/services/workout-actions.ts`) replaces the whole target week: existing days and exercises are deleted, so anything attached to them by cascade is deleted too.
- Admin member pages: `/admin/users/[id]` (week, completions, history), `/summary`, `/nutrition`, `/preview`.
- The Vercel build runs `drizzle-kit push` against production, so schema changes must be additive.

## Decisions

Rounds 1 and 2 answered 2026-10-22 by Hoan: all recommendations accepted.

| #   | Question                                               | Recommended                                                                                                                                         | Decision |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q1  | Log per set, or one line per exercise?                 | Per set: weight + reps for each set; number of rows prefilled from `sets`                                                                           | Accepted |
| Q2  | Units?                                                 | kg only, steps of 0.5 kg                                                                                                                            | Accepted |
| Q3  | Bodyweight and timed exercises (`30s`)?                | Weight optional (empty = bodyweight); reps is a whole number; timed exercises have no set logging in v1                                             | Accepted |
| Q4  | How does logging relate to "Đánh dấu đã tập"?          | Optional; saving the first set also marks the exercise done; marking done without sets stays possible                                               | Accepted |
| Q5  | Un-marking a done exercise: what happens to its sets?  | Sets are kept; un-mark only clears the check                                                                                                        | Accepted |
| Q6  | How do we know it is "the same exercise" across weeks? | Same user + same `youtubeId`                                                                                                                        | Accepted |
| Q7  | Which days can be logged or edited?                    | Same rule as completion: today and past days, never future                                                                                          | Accepted |
| Q8  | What does "getting stronger" mean?                     | Per exercise, the best set is the heaviest weight (tie: more reps); progress = latest best vs the previous best                                     | Accepted |
| Q9  | Where does the PT see it?                              | Member page: logged sets under each exercise; Summary tab: a per-exercise "Tiến bộ" list (latest best vs previous best). Not on the dashboard in v1 | Accepted |
| Q10 | How do trainees "feel proud"?                          | A "Kỷ lục mới" badge on the exercise card when a saved set beats the previous best; also shown in the admin recent activity. No push notification   | Accepted |
| Q11 | Do we show last time's numbers?                        | Yes: each set row shows the same set from the latest previous session as a hint ("Lần trước 40 kg × 10"); one tap copies it                         | Accepted |
| Q12 | Copy week onto a week that already has logged sets?    | Refuse with a message while the target week has logged sets (today copy silently deletes them)                                                      | Accepted |
| Q13 | Can the PT edit a trainee's sets?                      | No, read-only for the PT in v1                                                                                                                      | Accepted |
| Q14 | Can the trainee add or remove set rows?                | Yes: add rows beyond the PT's `sets`, delete own rows; at most 10 rows per exercise                                                                 | Accepted |

## Open questions for the client

These need the client, not the team. Each Story notes which one it depends on.

- OQ1: When the PT deletes an exercise or changes its YouTube link after the trainee logged sets, should the history disappear (today's cascade) or be kept? Assumption until answered: deleting the exercise deletes its sets; a new link starts a new history.
- OQ2: Should a set logged as bodyweight (no kg) ever count as a personal best? Assumption: only sets with a weight count.
- OQ3: Is "Tiến bộ" on the Summary tab enough for the PT, or does the client also want it on the dashboard soon? Assumption: Summary tab only (Q9).

## Out of scope (v1)

- Pounds, plate calculators, rest timers.
- Logging for timed exercises (`30s`, `1 phút`).
- Charts of weight over time; estimated one-rep max.
- PT editing a trainee's sets; push notifications; dashboard tiles.

## Ticket pack

Created in Jira 2026-10-22: epic KAN-20; KAN-21 (A), KAN-22 (B), KAN-23 (C), KAN-24 (QA). Full text lives on the tickets; the summaries below are the reference.

Order: Story A merges first; B and C run in parallel worktrees after it; the QA task follows B.

### KAN-20 Epic: [Capstone] Set logging: trainees record actual weight and reps per set

Links this spec. Children: A, B, C, QA.

### KAN-21 Story A: Store logged sets and compute bests

As a trainee, I want my sets saved against the exercise, so that the app can show last time's numbers and my records.

- Schema (additive): new table `exercise_sets` (id, exercise_id FK cascade, user_id FK cascade, position 0-based, weight_kg real nullable, reps integer, created_at; no updated_at, D4).
- Server action `saveExerciseSetsAction(exerciseId, sets[])`, replace-on-save (D1): `requireUser()` first, Zod (weight empty or 0.5-500 step 0.5, reps 1-100 integer, at most 10 rows; D3), only the trainee's own exercises, refuse future dates (Asia/Ho_Chi_Minh). Saving the first set inserts the completion if missing (Q4); un-marking keeps sets (Q5).
- Pure utils with Vitest tests: `getBestSet` (heaviest, tie on reps; weightless sets ignored, OQ2), `isPersonalBest`, `getPreviousSession` (same user + `youtubeId`, latest earlier date, Q6).
- `copyWeekAction` refuses when the target week has logged sets, with a Vietnamese error message (Q12).
  Acceptance criteria:
- Given a past or today exercise of mine, when I save 3 sets, then 3 rows exist and the exercise is marked done.
- Given a future exercise, when I save a set, then the action refuses and nothing is stored.
- Given another user's exercise id, when I save, then the action refuses.
- Given weight 40.25 or reps 0 or 11 rows, then validation fails with a message.
- Given a target week with logged sets, when the PT copies a week onto it, then the copy is refused and nothing changes.
- `pnpm test && pnpm lint && pnpm typecheck` green; new utils covered by tests.
  Files: `db/schema.ts`, `features/workouts/services/*`, `features/workouts/utils/*` (+ `__tests__`).

### KAN-22 Story B: Trainee logs sets while training

Depends on A. As a trainee holding a phone between sets, I want to log each set in a few taps, so that I stop guessing next week.

- On today's and past exercise cards (not timed ones, not future days): one row per set, prefilled count from `sets` (Q1), kg + reps inputs with large tap targets, add row / delete row (max 10, Q14).
- Hint per row "Lần trước 40 kg × 10" from the previous session; one tap copies it (Q11).
- "Kỷ lục mới" badge on the card when a saved set beats the previous best (Q10).
  Acceptance criteria:
- Given an exercise with 3 sets and a previous session, when I open it today, then I see 3 rows with last time's hints.
- Given I tap a hint and save, then the set is stored and the card shows "Đã tập xong".
- Given a set heavier than my previous best, when I save, then "Kỷ lục mới" shows on that card.
- Given a timed exercise (`30s`) or a future day, then no set rows are shown.
- Works at 390 px wide (iPhone 12) without horizontal scroll.
  Files: `features/workouts/components/UserExerciseItem`, `ExerciseCard`, new `SetLogger` component, hook `use-exercise-sets.ts`.

### KAN-23 Story C: PT sees logged sets and progress

Depends on A. As a PT, I want to see what each trainee lifted and who is getting stronger.

- Member page `/admin/users/[id]`: logged sets under each exercise, read-only (Q13).
- Summary tab: "Tiến bộ" list per exercise: latest best vs previous best, with the change in kg (Q8, Q9).
- Recent activity: an entry when a trainee sets a personal best (Q10).
  Acceptance criteria:
- Given a trainee logged sets this week, when the PT opens the member page, then each exercise lists its sets and there is no edit control.
- Given two sessions of the same exercise (same link), then "Tiến bộ" shows both bests and the difference.
- Given a trainee with no logged sets, then "Tiến bộ" shows an empty state.
- Every new admin query is behind `requireAdmin()` / the admin layout.
  Files: `app/admin/(protected)/users/[id]/*`, `features/members/*`, `features/dashboard/services/dashboard-queries.ts`.

### KAN-24 Task QA: Test matrix and first e2e suite

Depends on B. Test matrix in this file (one row per acceptance criterion, level unit or e2e). Add `@playwright/test` with an e2e run for the trainee flow (log sets, hint, record badge) against a seeded local DB, and run it in CI if it stays under 3 minutes.

## Sub-tasks

Each Story is split by layer; one branch and one PR per sub-task (`feat/KAN-<sub-task>-<short-name>`).

| Parent | Sub-task                                                     | Layer | Needs          |
| ------ | ------------------------------------------------------------ | ----- | -------------- |
| KAN-21 | KAN-25 Add `exercise_sets` table                             | BE    | -              |
| KAN-21 | KAN-26 Pure utils: best set, personal best, previous session | BE    | KAN-25         |
| KAN-21 | KAN-27 Save/delete set actions, linked to completion         | BE    | KAN-25         |
| KAN-21 | KAN-28 Copy week refuses a logged target week                | BE    | KAN-25         |
| KAN-22 | KAN-29 Load sets and last-session hints with the week        | BE    | KAN-21         |
| KAN-22 | KAN-30 `SetLogger` component                                 | FE    | KAN-21         |
| KAN-22 | KAN-31 Last-time hint and "Kỷ lục mới" badge                 | FE    | KAN-29, KAN-30 |
| KAN-23 | KAN-32 Admin queries: sets, progress, record activity        | BE    | KAN-21         |
| KAN-23 | KAN-33 Member page: read-only sets                           | FE    | KAN-32         |
| KAN-23 | KAN-34 Summary "Tiến bộ" list and activity entry             | FE    | KAN-32         |
| KAN-24 | KAN-35 Test matrix                                           | QA    | -              |
| KAN-24 | KAN-36 Playwright e2e setup and trainee spec                 | QA    | KAN-22         |

## Zero-questions test decisions

Each Story was read as a developer with no context (prompt E); every question went to Jira with a suggested answer. Hoan (BA) accepted all of them on 2026-10-22. They override the Story summaries above where they differ.

### KAN-21 (D1-D9)

| #   | Decision                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Replace-on-save: one `saveExerciseSetsAction(exerciseId, sets[])` deletes and re-inserts the exercise's rows; no delete action. |
| D2  | Saving an empty list clears the sets and keeps the completion.                                                                  |
| D3  | Weight is empty (bodyweight) or 0.5-500 in steps of 0.5; 0 is rejected.                                                         |
| D4  | No `updated_at` column; `position` is 0-based.                                                                                  |
| D5  | Wrapped in `withResultErrorHandling`; returns `{ status, personalBest }`.                                                       |
| D6  | Personal best = strictly better than every earlier set of that user + `youtubeId` before that date; a tie is not a record.      |
| D7  | "Previous session" means strictly earlier dates only; the same day never counts.                                                |
| D8  | Personal bests are computed on read, not stored.                                                                                |
| D9  | The copy-week guard checks logged sets only (completions alone do not block it).                                                |

### KAN-22 (E1-E8)

| #   | Decision                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------- |
| E1  | When `sets` is null, the logger starts with 1 row.                                                   |
| E2  | The reps input placeholder is the PT's target `reps`.                                                |
| E3  | One "Lưu" button saves all rows.                                                                     |
| E4  | A pure `isTimedReps` util detects timed exercises (`s`, `sec`, `giây`, `p`, `ph`, `phút`, `'`, `"`). |
| E5  | The admin preview shows the logger read-only.                                                        |
| E6  | The "Kỷ lục mới" badge is computed on read in KAN-29.                                                |
| E7  | Hints match by row position (row n shows the previous session's set n).                              |
| E8  | Toasts follow `useExerciseCompletion` (success and error).                                           |

### KAN-23 (F1-F6)

| #   | Decision                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------- |
| F1  | Member page: a read-only "Đã ghi:" line inside `ExerciseEditorItem`.                                 |
| F2  | `ActivityItem` gets a `kind` field; list keys are `${kind}-${id}`.                                   |
| F3  | Personal-best entries also show in the `/admin` dashboard activity list; no new tile.                |
| F4  | "Tiến bộ" compares the selected week's best with the best before it.                                 |
| F5  | When the title changed across weeks, show the latest title.                                          |
| F6  | Bodyweight-only exercises are excluded from "Tiến bộ"; an exercise with one session shows "Lần đầu". |

## Test matrix

To be filled by KAN-24.
