# Plan: Public UUID ids

## Source

- Intent: `intent/2026-11-08-public-uuid-ids.md`
- Spec: `docs/specs/public-uuid-ids.md`
- KAN key: none (Hoan, 2026-11-08)

## Files that change

Phase 1 (foundation + users/admins):

- `db/schema.ts`: `publicId: text("public_id").$defaultFn(() => crypto.randomUUID())` plus `uniqueIndex` on `users` and `admins`.
- `utils/public-id.ts` (new): `publicIdSchema`, `newPublicId()`; tests.
- `services/backfill-public-ids.ts` (new): `backfillPublicIds(db, tables)` batches `UPDATE ... SET public_id = ? WHERE id = ? AND public_id IS NULL`; tests on in-memory libSQL.
- `scripts/setup-database.ts`: call `backfillPublicIds()` after `pushSchema()`.
- `utils/routes.ts`: admin user path helpers take `publicId: string`.
- `app/admin/(protected)/users/[id]/**/page.tsx`: `findUserByPublicId(id)`, `notFound()` otherwise.
- `features/members/**`: `findUserByPublicId`, DTOs expose `publicId` not `id`, actions validate `publicIdSchema` and resolve once.
- Forms with hidden `userId`/`targetUserId` (CopyWeekButton, ExerciseFormView, DayInfoForm, TargetForm, BodyProfileFormView) and their schemas (`workout-schemas`, `nutrition-schemas`, `meal-plan-schemas`, `member-actions`, `member-login-actions`, `chat-hidden-actions`, `chat-admin-actions`).
- `features/avatar/**`, `app/api/avatar/[kind]/[id]/route.ts`: URL and lookup by public id.
- `app/api/presence/peer/route.ts`, `app/api/chat/photos/route.ts` (`userId` query param), `use-chat-adapter.ts`.
- `features/chat/utils/push-rules.ts`: url built from the trainee public id.
- Lists linking to members: ChatInboxList, AdminInbox, HiddenUserList, RecentActivityList, MemberSectionTabs.
- `e2e/seed.ts` and specs: ids to public ids (not run).

Phase 2 (foods, meal plan, meal logs), phase 3 (exercises, food entries), phase 4 (chat): same pattern, files listed per table in the spec inventory; each phase's PR updates this section's "Deviations" if its file list differs.

## Order of work

1. Phase 1 commit 1: schema columns + backfill service + setup step + `publicIdSchema`, with tests. Verify locally: `pnpm db:push` on local SQLite with existing rows, run setup, every row has a UUID, rerun changes nothing.
2. Phase 1 commit 2: users/admins boundary switch (routes, pages, actions, forms, avatar, presence, push). `pnpm verify`, then click through admin member pages and a trainee session on local DB.
3. PR 1 into `stag`, `/code-review`, merge when CI and review are green.
4. Phases 2, 3, 4, each as its own PR in that order, same verify steps.
5. After phase 4: grep for `z.coerce.number()` / `Number(id)` / `Number(params` at boundaries and for integer `id` fields in client DTO types; fix leftovers in a small follow-up PR.

## Risks

- **Production build runs push + backfill on the base Turso DB.** Only `ADD COLUMN` and `CREATE UNIQUE INDEX` (NULLs are distinct in SQLite, so the index succeeds before backfill). Backfill is idempotent; a failed build leaves partial UUIDs that the next build completes. No `--force`, no table rebuild.
- **Window between push and backfill** (same build, seconds): old deployment still serving ignores the column. New deployment starts only after the build, so it never sees NULLs.
- **Turso preview branch DBs** get the same push + backfill; no extra step.
- **Missed boundary** (an integer id still exposed or still accepted): caught by the phase grep check and review; low impact because owner checks still guard access.
- **Chat clients mid-session during phase 4**: old tabs use numeric channel names; they reconnect with a new token and reload on the next navigation. Hard refresh at worst.
- **Old bookmarks** to `/admin/users/<n>` 404 (accepted in the spec).

## Proof

- Unit tests listed in the spec's test matrix; `pnpm verify` tail pasted in each PR.
- Local DB check of the backfill (row counts with NULL `public_id` before/after, rerun is a no-op).
- Browser check on local DB per phase: the changed pages load with UUID URLs, numeric URL 404s (`browser-proof`).
- e2e: skipped per Hoan (2026-11-08); specs updated but not run.

## Deviations

None yet.
