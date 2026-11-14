# Plan: Super admin blocks a trainee

## Source

- Intent: none (owner-approved request, no intent file)
- Spec: `docs/specs/admin-block-user.md`
- KAN key: none (Jira skipped by Hoan)

## Files that change

- `db/schema.ts`: new table `user_restrictions` (additive).
- `features/restrictions/`: new feature.
  - `constants/`: levels, durations, reason limit, Vietnamese message constants.
  - `types/restriction.ts`, `utils/restriction-rules.ts` (isActive, until from duration, Zod schemas) with tests.
  - `services/restriction-queries.ts` (active row, per-user map, suspended ids, SQL rule), `restriction-mutations.ts` (block with replace, lift, delete for member delete), `restriction-guard.ts` (`restrictionErrorFor`), `restriction-actions.ts` (`requireSuperAdmin()` first, Zod), `restriction-messages.ts` (login refusal text).
  - `components/`: `BlockUserSheet` (reusable, takes `userId`), `BlockUserControl`, `RestrictionSummary`, `RestrictionBanner`, `RestrictionBadge`; `hooks/use-block-user.ts`.
- `services/auth-guard.ts`: `getCurrentUser` rejects a suspended trainee.
- `features/auth/services/auth-actions.ts`: login refuses a suspended trainee after the password check.
- `features/chat/services/chat-actions.ts`, `features/social/services/{actor-guard,social-actions,engagement-actions,friend-actions,dm-actions}.ts`, `app/api/{chat,dm,social}/photos/route.ts`: refuse restricted writes.
- `features/social/services/relationships.ts`, `friend-queries.ts`: suspended trainees count as blocked either way and drop out of pending requests.
- `features/members/services/member-actions.ts`: delete the trainee's restrictions.
- `app/(user)/(protected)/layout.tsx`: banner. `app/admin/(protected)/users/[id]/(week)/page.tsx`: block control (super admin only). `app/admin/(protected)/(home)/page.tsx`, `features/dashboard/*`: list badge.
- `messages/{vi,en,zh}/restrictions.json` (new namespace, registered in `i18n/messages.ts` and `i18n/client-namespaces.ts`), `messages/*/errors.json` (`restriction` group, `toasts.suspended*`).
- `docs/specs/admin-block-user.md` and this plan.

## Order of work

1. Docs (spec and plan).
2. Schema `user_restrictions` and the pure rules with unit tests.
3. Queries, mutations, guard, super-admin actions, with service tests.
4. Enforcement: session check, login refusal, guarded write actions and uploads, suspended hidden from social, member delete cleanup, with tests.
5. UI: messages in three languages, block sheet and control, banner, list badge.
6. `pnpm verify`, `pnpm format`.

## Risks

- `getCurrentUser` now runs one extra small query per request (cached per request with React `cache`). Contained by the index on (`user_id`, `created_at`) and by it returning early for most trainees.
- `isBlockedBetween` and `listBlockedBetweenIds` read the list of suspended ids (small by nature). If suspensions ever become numerous this wants a join instead.
- Schema is additive (new table), safe for `drizzle-kit push` on production.
- A guarded write that is added later must call `restrictionErrorFor` itself; the spec lists the current set.

## Proof

- Unit tests in `features/restrictions/**/__tests__`, `features/members/services/__tests__/member-actions.test.ts`, `i18n/__tests__`.
- `pnpm verify` green; `pnpm format` clean.
- No e2e (owner). Browser check left for review: super admin blocks from the trainee page, trainee sees the banner, a suspended trainee gets the login message.

## Deviations

- None yet.
