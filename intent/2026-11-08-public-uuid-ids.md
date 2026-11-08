# Intent: Public UUID ids instead of sequential ids

- **Author:** Hoan
- **Status:** accepted
- **KAN key:** none (Hoan, 2026-11-08: no Jira ticket for this change)

## Problem

Every table uses an auto-increment integer id (1, 2, 3, ...) and those ids show up in URLs, API routes, form fields, realtime channel names and push payloads. Anyone who sees one id can guess the next one, count our trainees, and probe other people's records. Hoan: "id của user đang là số 1,2,3... điều này khá nguy hiểm".

## Proposed outcome

- No integer id ever leaves the server. Every id a browser, URL, API, Ably channel or push notification sees is a random UUID v4.
- Users first, then foods and meal plans, then workouts and nutrition, then chat.
- A URL or request with an old numeric id returns 404 (or a validation error), never someone's data.
- No data loss; existing rows keep working after the deploy.

## Affected users and systems

Admins (PTs) and trainees: every admin member page, food pages, meal plan, workout, nutrition and chat screens. Tables that cross the boundary (see spec). Ably channels, web push, avatar and chat image URLs. Vercel build (`scripts/setup-database.ts --prebuild`).

## Constraints

- Hoan chose (decision card, 2026-11-08): add a `public_id` UUID column and keep the integer primary key as the internal key. No primary key rebuild.
- Additive schema only: the Vercel build runs `drizzle-kit push` (never `--force`) against the production base Turso DB.
- e2e tests are skipped until Hoan says otherwise (2026-11-08).
- UI copy stays Vietnamese.

## Open questions

- None blocking. Old bookmarked admin URLs (`/admin/users/3`) will 404 after phase 1; Hoan accepts or asks for a one-time redirect.

## Out of scope

- Changing primary keys or foreign keys to UUID.
- The signed session cookie keeps the integer `userId`/`adminId`: it is a signed JWT in an httpOnly cookie, so page scripts cannot read it and nobody can forge another id into it; the owner seeing their own number in devtools leaks nothing new once no other surface accepts integer ids.
- Tables never exposed to clients (login_attempts, rate limits, nicknames, colour overrides, hidden lists, read cursors' own rows, push subscriptions).
