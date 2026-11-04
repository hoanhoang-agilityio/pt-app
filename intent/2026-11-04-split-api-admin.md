# Intent: Split pt-app into a NestJS API, a trainee web app and an admin web app

- **Author:** Hoan
- **Status:** draft
- **KAN key:** KAN-TBD (epic filed after the analysis is approved)

## Problem

pt-app is one Next.js app: the trainee screens, the admin (PT) screens and all data access (Server Actions and Server Components calling Drizzle directly) ship and deploy together. Hoan wants the backend as its own NestJS service and the admin as its own standalone web app.

## Proposed outcome

- A NestJS API owns the database, auth, sessions, rate limiting and every business rule.
- The trainee web app and the admin web app are separate Next.js apps that only talk to the API.
- Each part builds, tests and deploys on its own, from one pnpm monorepo, with CI and Jira sync kept working.
- Users see no change: same URLs for trainees, same Vietnamese UI, same data.

## Affected users and systems

Admins (PTs), trainees, every screen and table, Vercel, Turso, GitHub Actions (CI, e2e, Jira sync, Claude review), the cloud SessionStart hook, CLAUDE.md and the hoan-dev-skills.

## Constraints

Low cost (free tiers first). Schema changes stay additive. Node 24 and pnpm. UI copy Vietnamese; code and docs English. No downtime for trainees.

## Open questions

See "Open questions" in `docs/specs/split-api-admin.md`.

## Out of scope

New features, a schema redesign, moving off Turso/Drizzle, a native mobile app (the API makes one possible later).
