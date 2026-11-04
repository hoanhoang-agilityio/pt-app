# Spec: Split pt-app into a NestJS API, a trainee web app and an admin web app

- **Intent:** `intent/2026-11-04-split-api-admin.md`
- **KAN key:** KAN-TBD (epic and stories filed after this analysis is approved)
- **Status:** analysis, waiting for approval. No code changes until the plan is approved.

This document is the Analyze and Plan step of the dojo developer flow for a change across the whole repo. It covers code, deployment, CI/CD and devops, gives options with a recommendation, a phased ticket breakdown and the open questions.

## 1. Where we are today

| Area           | Today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App            | One Next.js 16 App Router app (React 19, React Compiler, Tailwind 4), mobile first, PWA (service worker, two manifests).                                                                                                                                                                                                                                                                                                                                                             |
| Areas          | Trainee: `/`, `/workouts`, `/nutrition`, `/summary`, `/foods`, `/account`. Admin: `/admin/*` (dashboard, users, user nutrition/summary/preview, foods).                                                                                                                                                                                                                                                                                                                              |
| Data access    | No HTTP API. 12 `"use server"` files export 44 Server Actions; about 40 query functions in `features/*/services/*-queries.ts` and `meal-plan-store.ts` are called from Server Components. `revalidatePath` refreshes pages after writes.                                                                                                                                                                                                                                             |
| DB             | Drizzle ORM on libSQL: local SQLite file, Turso in production. 18 tables in `db/schema.ts`. `drizzle-kit push` runs in the Vercel build (`scripts/setup-database.ts --prebuild`).                                                                                                                                                                                                                                                                                                    |
| Auth           | Email + password for trainees, username + password for admins (KAN-82..86). Passwords hashed in `services/password.ts`. Sessions are HS256 JWTs (`jose`) in two httpOnly `SameSite=Lax` cookies (user, admin). `proxy.ts` does optimistic cookie checks, cross-role redirects and slides the user session once a day. `services/auth-guard.ts` (`requireUser`, `requireAdmin`) re-checks the DB on every page and action, including "password changed since the session was issued". |
| Rate limiting  | DB backed (`login_attempts` table): 5 failures lock a key for 15 minutes; keys `user:<email>` and `admin:<username>`. Works on serverless because state is in the DB.                                                                                                                                                                                                                                                                                                                |
| Errors         | `services/action-errors.ts`: production shows a generic Vietnamese message plus a reference id; details go to `services/logger.ts`.                                                                                                                                                                                                                                                                                                                                                  |
| Validation     | Zod schemas per feature (`*-schemas.ts`), pure rules in `utils/` and `features/*/utils` (unit tested).                                                                                                                                                                                                                                                                                                                                                                               |
| Shared UI      | The admin reuses trainee components: `WorkoutWeek`, `NutritionWeek`, `TraineeMealPlan`, `FoodList`, `FoodDetail`, `BodyProfileCard`, the preview page renders the trainee view.                                                                                                                                                                                                                                                                                                      |
| Deploy         | One Vercel project, auto deploys `main` to https://pt-app-sepia.vercel.app/. Turso via the Vercel integration (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`).                                                                                                                                                                                                                                                                                                                            |
| CI             | `ci.yml`: test, lint, typecheck, Playwright e2e (one Next dev server, seeded SQLite). `jira-sync.yml`, `claude.yml`, `claude-code-review.yml`.                                                                                                                                                                                                                                                                                                                                       |
| Cloud sessions | `scripts/cloud-session-setup.sh` (SessionStart): Node 24, `pnpm install`, `.env.local`, local SQLite via `db:setup`.                                                                                                                                                                                                                                                                                                                                                                 |

What this means for the split: the code is already layered (routes thin, `services/` and `*-queries.ts` hold the logic, Zod at the boundary), so the business logic can move almost as is. The real work is (a) putting an HTTP boundary where Server Actions call Drizzle today, (b) sessions and cookies across separately deployed apps, and (c) three deploys instead of one.

## 2. Honest trade-off (advisor note)

The split costs more than it gives for the app as it is today: an extra network hop on every page (web, then API, then Turso), two more deploys, CORS/cookie work and a migration of 44 actions and about 40 queries. It pays off when:

- another client needs the same data, for example the planned Expo nutrition app (`nutri-plan`) or a native app;
- the admin should ship, scale or be locked down separately from the trainee app;
- the goal is to practise a NestJS + monorepo + multi-app CI/CD setup (a fair training goal).

If none of these is a real need, a cheaper middle path exists (option C below). The recommendation assumes Hoan wants the full split.

## 3. Target architecture options

### Option A (recommended): monorepo, NestJS API, two Next.js apps that call it through their own server (BFF)

```
pt-app/                     pnpm workspace
  apps/
    api/        NestJS 11: auth, sessions, rate limit, all reads and writes, Drizzle
    web/        Next.js trainee app (current routes minus /admin)
    admin/      Next.js admin app (current /admin routes, served at /)
  packages/
    db/         Drizzle schema, client factory, setup/seed scripts (imported by api only)
    contracts/  Zod schemas, DTO types, error codes, route constants (api + both apps)
    domain/     pure rules: week, macros, solve-grams, set rows, progress (api + apps)
    ui/         components both apps render (WorkoutWeek, NutritionWeek, TraineeMealPlan, FoodList, ...)
    config/     shared tsconfig, eslint, prettier, vitest presets
```

How a request flows:

- The browser only ever calls its own app's origin. Next Server Components and Server Actions in `web`/`admin` call the API server to server with `fetch`, forwarding the session cookie.
- Login and logout: the Server Action calls `POST /auth/...` on the API, takes the token from the response and sets the httpOnly cookie on the app's own domain (same as today). The API verifies the token on every call with a NestJS guard.
- Server Actions stay, as thin wrappers (`await api.post(...)`, then `revalidatePath`). The existing forms, hooks, `useActionState` and progressive enhancement keep working, so the UI layer barely changes.

Why: no browser CORS, no third-party cookies, no change for Safari ITP, the least UI rewrite, and the API is still a normal REST API another client (mobile) can use with a bearer token.

### Option B: browser calls the API directly (SPA style)

The apps call `https://api...` from the browser with `credentials: "include"`. Needs CORS with an allow list, and cookies the browser accepts on a different origin. On `*.vercel.app` that fails: `vercel.app` is on the Public Suffix List, so `pt-app-api.vercel.app` and `pt-app-sepia.vercel.app` are different sites and the cookie becomes third party (blocked by Safari, and by Chrome in many setups). It only works with one custom domain and subdomains (`api.x.com`, `app.x.com`, `admin.x.com`, cookie `Domain=.x.com`, `SameSite=Lax`). It also means rewriting every Server Component read into client fetching (React Query or similar). More work, more risk, a domain cost. Not recommended now.

### Option C (cheapest): monorepo with two Next.js apps, no NestJS yet

Split `admin` into its own app, move the logic into `packages/core` that both apps import, and keep Server Actions calling Drizzle directly. No API hop, no session redesign. NestJS can come later behind the same packages. Good if the main goal is a standalone admin.

### Recommendation

Option A, done in phases so that the admin split (which is useful on its own) lands first and every phase ships with green CI and no user-visible change. Option C is literally phases 0 to 2 of option A, so the work is not wasted if Hoan stops there.

## 4. Code: what moves where

### 4.1 Moves to `apps/api` (NestJS)

| Today                                                                                                                                       | In the API                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/*/services/*-queries.ts`, `meal-plan-store.ts`, `body-profile-service.ts`, `create-member-with-login.ts`, `seed-foods-service.ts` | One Nest module per feature (`AuthModule`, `MembersModule`, `WorkoutsModule`, `NutritionModule`, `FoodsModule`, `MealPlansModule`, `DashboardModule`, `HealthModule`), each with a controller and a service. Service code is copied with small changes (no `server-only`, no `next/*`). |
| The 44 Server Actions' logic (validate, check ownership, write)                                                                             | Controller endpoints: Zod validation through a small `ZodValidationPipe` (or `nestjs-zod`), then the service. The Next Server Action keeps only the call and `revalidatePath`.                                                                                                          |
| `services/auth-guard.ts` (`requireUser`, `requireAdmin`, stale-session check)                                                               | `SessionGuard` + `@Roles("user" \| "admin")` decorator + `@CurrentUser()` param decorator. Same DB re-check per request, same "password changed after the session" rule.                                                                                                                |
| `services/session-token.ts` (`jose`, HS256)                                                                                                 | `SessionService` in the API; the same secret and payload, so tokens issued before and after the move stay valid.                                                                                                                                                                        |
| `services/login-limiter.ts`, `utils/login-limiter-rules.ts`                                                                                 | Unchanged logic in `AuthModule` (DB backed, so it keeps working on serverless). Optionally add `@nestjs/throttler` per IP as a second layer later; not needed now.                                                                                                                      |
| `services/password.ts`, `admins.ts`, `users.ts`                                                                                             | `AuthModule` / `MembersModule`.                                                                                                                                                                                                                                                         |
| `services/action-errors.ts`, `logger.ts`, `utils/errors.ts`                                                                                 | A global exception filter that maps `AppError` codes to HTTP status + `{ code, message, ref }`. The apps keep showing the generic Vietnamese message plus the ref id.                                                                                                                   |
| `services/env.ts`, `services/health.ts`, `app/api/health`                                                                                   | API `ConfigModule` and `GET /health` (same token rule).                                                                                                                                                                                                                                 |
| `db/`, `drizzle.config.ts`, `scripts/setup-database.ts`, `create-admin.ts`, `seed-*.ts`, `rekey-users.ts`                                   | `packages/db`; only the API (and scripts) import it.                                                                                                                                                                                                                                    |

API style: REST, JSON, prefix `/v1`, resource routes (`GET /v1/me/workouts?week=...`, `POST /v1/admin/users/:id/workout-days`, ...). The exact route table is the first task of each feature story. Generate an OpenAPI document with `@nestjs/swagger` for free docs.

### 4.2 Stays in the web apps

- `app/` routes, layouts, `error.tsx`, PWA (`sw.js`, manifests, offline page, install prompt), all components and hooks, Tailwind.
- Server Actions as thin BFF wrappers, `revalidatePath`, redirects.
- `proxy.ts` becomes a cookie-presence check per app (see 4.5).

### 4.3 Shared packages

- `packages/contracts`: every `*-schemas.ts` (Zod), DTO types inferred from them, error codes, `constants/` that both sides need. The API validates with these and the apps validate forms with the same ones, so the two cannot drift.
- `packages/domain`: pure functions in `utils/` and `features/*/utils` with their `__tests__` (week math, macros, `solve-grams`, set rows, progress text). Used by the API for rules and by the apps for display.
- `packages/ui`: components both apps render. Moving them is mechanical but touches many imports; keep the `PascalCase/index.tsx` convention.
- Packages are TypeScript source consumed directly (`"exports"` to `.ts`, Next `transpilePackages`, Nest built with `tsc`/SWC). No publishing, no build step per package.

### 4.4 Auth and sessions in detail

- Trainee login: `web` Server Action `login(email, password)` calls `POST /v1/auth/user/login`. The API applies the limiter, checks the hash, returns `{ token, maxAge }`. The action sets the `USER_COOKIE` on the web origin (httpOnly, Secure, `SameSite=Lax`), as today.
- Admin login: same on `admin` with `POST /v1/auth/admin/login` and `ADMIN_COOKIE` on the admin origin.
- Every server-side call from an app sends `Authorization: Bearer <cookie value>`. The API never needs browser cookies, so it needs no CORS and works for a future mobile client unchanged.
- Sliding refresh (today in `proxy.ts`): the API returns a refreshed token in a response header when the session is older than a day; the app's fetch helper writes it back to the cookie (a Server Action or route handler can; for Server Component reads, a small `/session/refresh` route handler or the proxy does it). Detail to settle in the auth story's plan.
- Change password, admin reset (one-time password), "sign out sessions issued before the change": the same logic, now in the API.
- Service-to-service trust: the API is public (it must be reachable from Vercel functions), so every endpoint except login and health requires a valid session token. Optionally the apps also send an `X-Internal-Key` secret so random callers get 401 early.

### 4.5 Behaviour that becomes obsolete (revise-existing-features)

Proposed removals or changes, for Hoan to confirm:

1. `proxy.ts` cross-role redirects (admin cookie on trainee pages goes to `/admin`, user cookie on `/admin` goes to `/workouts`). With separate origins each app only sees its own cookie; the redirects can go. Proposal: remove.
2. `/admin-manifest.webmanifest` and the admin branches of the PWA manifest code: the admin app gets its own normal `manifest.ts`. Proposal: remove from `web`.
3. `/session/end` route handler: stays per app, but only for its own cookie.
4. `server-only` imports and direct `@/db` imports in the apps: removed; an ESLint rule (`no-restricted-imports` of `@pt/db`) in `web` and `admin` stops them coming back.
5. `app/api/health` in `web`: replaced by the API's `/health`; `web` and `admin` keep a tiny `/api/health` that also pings the API (useful for uptime checks). Proposal: keep both, thin.
6. The Vercel prebuild that runs `drizzle-kit push` from the web build: moves to the API build only, so exactly one project changes the schema.
7. The admin "preview as trainee" page: keeps working by rendering the shared `packages/ui` trainee components with data the admin endpoints return.

## 5. Database (Turso, Drizzle)

- Keep Turso and Drizzle. Free tier is enough; no migration of data.
- Only `apps/api` connects. The apps lose `TURSO_*` env vars, which removes DB credentials from two deploys.
- Keep `drizzle-kit push` (additive schema rule unchanged) but run it from the API's Vercel build only. Later option: switch to `drizzle-kit generate` + `migrate` for reviewed SQL migrations; not part of this work.
- Latency: put the API function region next to the Turso database region (check the Turso region; Vercel default is `iad1`). Web functions in the same region. Each page then costs one extra in-region hop (a few ms), plus a cold start on the API when it has been idle.
- Previews: previews must never write to production. Use a second Turso database (`pt-app-preview`, free tier allows several) for every preview deploy of the API. Open question: what previews use today.

## 6. Monorepo layout and tooling

- pnpm workspaces (`pnpm-workspace.yaml` lists `apps/*`, `packages/*`; the existing `onlyBuiltDependencies` stays). One lock file. Node 24 everywhere (`engines`, `.nvmrc`).
- Package names `@pt/api`, `@pt/web`, `@pt/admin`, `@pt/db`, `@pt/contracts`, `@pt/domain`, `@pt/ui`, `@pt/config`.
- Root scripts: `pnpm verify` = `pnpm -r test && pnpm -r lint && pnpm -r typecheck`; `pnpm dev` runs all three apps (`pnpm -r --parallel dev`, ports 3000 web, 3001 admin, 4000 api).
- Turborepo: not needed at first. pnpm's `--filter "...[origin/main]"` already runs only what a PR touched. Add Turbo (local cache only, free) if CI gets slow.
- Tests: Vitest per package (pure tests move with their code); API gets Nest e2e tests with `supertest` against a temp SQLite file (fast, no browser). Playwright stays at the root for full user flows.
- Conventions to update: `@/` alias per app, ESLint import groups add `@pt/*`, `.claude/hooks` (format-on-edit, test-guard) work on new paths, CLAUDE.md layout section, skills that name paths (`project-map-refresh` task).

## 7. Deployment

### 7.1 Where the NestJS API runs (cost aware)

| Host                                     | Cost                                  | Cold start / sleep                                               | Fit                                                                                        |
| ---------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Vercel (Hobby), NestJS as a function** | $0                                    | Cold start after idle (usually under 1–2 s for a small Nest app) | Same platform, same Turso integration, previews per PR, instant rollback. **Recommended.** |
| Render free web service                  | $0                                    | Sleeps after 15 min, 30–60 s to wake                             | Bad first load for trainees.                                                               |
| Railway                                  | about $5/month (no lasting free tier) | Always on                                                        | Simple, but a monthly bill.                                                                |
| Fly.io                                   | about $2–5/month for a small VM       | Always on, or scale to zero with slower wake                     | More ops (Dockerfile, regions).                                                            |
| Koyeb / Northflank free                  | $0                                    | Small, sleeps or limited                                         | Extra vendor to learn.                                                                     |

Vercel supports NestJS as a framework preset (zero config) in current versions; confirm during the API skeleton story and fall back to a small `api/index.ts` serverless entry that boots the Nest app once per instance if needed. Keep the Nest app serverless friendly: no in-memory state, no long-lived timers, DB client created once per instance (as `db/index.ts` does now).

Note: Vercel Hobby is for non-commercial use. If pt-app will be used commercially by PTs, the Pro plan ($20/user/month) applies to all three projects. Open question.

### 7.2 Projects, domains, env vars

Three Vercel projects from the same GitHub repo, each with its Root Directory:

| Project                                                       | Root         | Domain (no custom domain)                    | Env vars                                                                                                                                                                                              |
| ------------------------------------------------------------- | ------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pt-app` (keep the existing project so the trainee URL stays) | `apps/web`   | https://pt-app-sepia.vercel.app/ (unchanged) | `API_URL`, `INTERNAL_API_KEY` (optional)                                                                                                                                                              |
| `pt-app-admin` (new)                                          | `apps/admin` | `pt-app-admin-<suffix>.vercel.app`           | `API_URL`, `INTERNAL_API_KEY` (optional)                                                                                                                                                              |
| `pt-app-api` (new)                                            | `apps/api`   | `pt-app-api-<suffix>.vercel.app`             | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (integration), `SESSION_SECRET` (same value as today), `HEALTH_CHECK_TOKEN`, `INTERNAL_API_KEY`, `ADMIN_USERNAME`/`ADMIN_PASSWORD` (only for `admin:create`) |

- With option A no custom domain is required (cookies are first party on each app's own origin). A custom domain (about $10–15/year) is optional and only cosmetic; it becomes required only for option B.
- `/admin/*` on the trainee domain: during the switch, redirect `/admin/*` to the admin app's URL (a `redirects()` entry in `apps/web/next.config.ts`) so bookmarks keep working; remove after a few weeks.
- Each project uses "Ignored Build Step" (`git diff --quiet HEAD^ HEAD -- . ../../packages` or `npx turbo-ignore`) so a change to the admin does not redeploy the trainee app.

### 7.3 Previews

- Each PR gets up to three preview deploys. The web/admin previews must call the API preview of the same branch: set `API_URL` in the Preview environment to the API project's branch URL pattern (`https://pt-app-api-git-<branch>-<team>.vercel.app`), computed in the apps from `VERCEL_GIT_COMMIT_REF`.
- Vercel Deployment Protection on previews blocks server-to-server calls; use the protection bypass secret header from the apps, or turn protection off for the API previews (they only reach the preview DB).
- The API preview uses the preview Turso DB (section 5).

### 7.4 Release order and rollback

- Rule: the API is backward compatible for at least one release. Additive endpoints and fields only; remove old ones a release later. Deploy the API first, then the apps (merging to `main` deploys all three; the API change ships in an earlier PR when an app depends on it).
- Rollback: Vercel instant rollback per project. Because the API stays backward compatible, rolling back one app or the API alone is safe. Schema changes stay additive, so a rollback never needs a DB rollback.
- Tag releases per app (`api-v1.1.0`, `web-v1.1.0`, `admin-v1.0.0`) or keep one repo version; open question, recommendation is one repo version with release notes per app.

### 7.5 Cost summary

| Item                           | Cost                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Vercel Hobby, 3 projects       | $0 (non-commercial)                                                                                      |
| Turso free (prod + preview DB) | $0                                                                                                       |
| GitHub Actions                 | $0 on a public repo; a private repo has 2,000 free minutes/month, path filters keep usage close to today |
| Custom domain                  | optional, about $10–15/year                                                                              |
| Total                          | **$0/month** with the recommendation                                                                     |

## 8. CI/CD and devops

- `ci.yml` becomes one workflow with a `changes` job (`dorny/paths-filter`) that outputs which of `api`, `web`, `admin`, `packages` changed. Jobs `api-checks`, `web-checks`, `admin-checks` run `pnpm --filter <app>... test lint typecheck` only when needed (a `packages/*` change runs every dependant). A final `ci-ok` job always runs and is the single required check, so branch protection works when jobs are skipped.
- API e2e (supertest, temp SQLite) runs in `api-checks`; fast.
- Playwright e2e: `webServer` becomes an array (API on 4000, web on 3000, admin on 3001) on one seeded SQLite file; specs split into `e2e/web/*` and `e2e/admin/*`. Runs when any app or package changed. Same 10-minute budget, still non-required until it is stable.
- `jira-sync.yml`: no change in behaviour; `scripts/jira-sync.ts` moves to `tools/` (root workspace) with its tests.
- `claude.yml` and `claude-code-review.yml`: no change; `REVIEW.md` gets the new boundaries (no DB imports in apps, API backward compatibility).
- Secrets: GitHub keeps only `JIRA_*` and the Claude token; app secrets live in Vercel per project and environment. `SESSION_SECRET` only in the API project after phase 4.
- Branch and release flow: unchanged. One KAN ticket per branch, PR per sub-task, `main` protected, Vercel deploys `main`.
- Cloud SessionStart hook: `scripts/cloud-session-setup.sh` installs from the root, writes `apps/api/.env.local` (local SQLite, random secret) and `apps/web/.env.local`, `apps/admin/.env.local` (`API_URL=http://localhost:4000`), runs `pnpm --filter @pt/db db:setup`. The remote-DB guard stays.
- Observability (free): Vercel logs per project; the API logs one line per request with the ref id the apps show, so a user's "mã lỗi" can be found in API logs.

## 9. Migration phases

Each phase is a separate story, ships with `pnpm verify` and e2e green, and leaves production working.

| Phase                                             | What                                                                                                                                                                                                                                      | User-visible change                   | Risk                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| 0. Monorepo shell                                 | Move the current app to `apps/web` unchanged, root workspace, shared config, CI and SessionStart on the new paths, Vercel Root Directory switch.                                                                                          | None                                  | Medium: Vercel root switch; test on a preview first.                  |
| 1. Shared packages                                | Extract `packages/db`, `contracts`, `domain`, `ui` from `apps/web`; imports updated; tests move with code.                                                                                                                                | None                                  | Low, mechanical (good Haiku/Sonnet work).                             |
| 2. Admin app                                      | Create `apps/admin` from `app/admin/*` (still calling `packages/db` through shared services), new Vercel project, redirect `/admin/*`, remove admin from `web`, remove obsolete proxy/manifest code.                                      | Admin moves to a new URL              | Medium: admin login cookie on a new origin, admin must re-login once. |
| 3. API skeleton                                   | `apps/api` with Config, DB, Health, exception filter, `SessionGuard`, `AuthModule` (login, logout, change password, rate limit), OpenAPI, supertest e2e; deploy `pt-app-api`; `drizzle-kit push` moves to the API build.                  | None                                  | Medium: Vercel NestJS function setup, cold start.                     |
| 4. Auth through the API                           | Both apps log in through the API; `SESSION_SECRET` and the DB check move to the API; sliding refresh through the API.                                                                                                                     | None (tokens stay valid, same secret) | High: sessions; keep the old path behind a flag until verified.       |
| 5. Features through the API, one module per story | Foods, Members, Workouts (+ sets, completions), Nutrition (targets, entries, body profile, weight), Meal plans (+ logs, marks, preferences), Dashboard. Each: endpoints + tests, then switch the app's queries/actions to the API client. | None                                  | Medium per module; small PRs.                                         |
| 6. Cut over and clean up                          | Remove `packages/db` from the apps' dependencies, ESLint guard, delete `TURSO_*` from web/admin projects, update CLAUDE.md, README, REVIEW.md, skills paths, release notes.                                                               | None                                  | Low.                                                                  |

Rough size: phase 0–2 about 3–4 days, phase 3–4 about 3 days, phase 5 about 6–8 days (six modules), phase 6 about 1 day. Total roughly 3 weeks of focused work. Stopping after phase 2 gives option C.

### Main risks and mitigations

| Risk                                                      | Mitigation                                                                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions break, trainees get logged out                   | Same `SESSION_SECRET` and payload in the API; phase 4 behind a flag; e2e login specs for both roles; the trainee app keeps its URL.                                       |
| Two projects push the schema, or a preview writes to prod | Only the API build runs `drizzle-kit push`; preview DB for previews; the cloud hook's remote-DB guard stays.                                                              |
| Slower pages (extra hop, cold starts)                     | Same region for API, apps and Turso; batch reads per page into one endpoint where a page needs many (dashboard, week views). Measure p95 before and after on the preview. |
| API and apps drift                                        | `packages/contracts` Zod schemas used on both sides; typed API client generated from the same types.                                                                      |
| Big-bang PRs                                              | One module per PR; phase 1 moves code with no logic change; CI per package.                                                                                               |
| Vercel Hobby limits or terms                              | Check function limits (duration, invocations) against usage; open question on commercial use.                                                                             |
| Tooling and docs go stale (hooks, skills, CLAUDE.md)      | Phase 0 and 6 each carry a doc/tooling sub-task; `project-map-refresh`.                                                                                                   |

## 10. Ticket breakdown (Jira KAN, filed after approval)

Epic: **Split pt-app into NestJS API, trainee web and admin web**. Each story is one branch and one PR per sub-task; sub-tasks prefixed [BE], [FE], [QA], [DEVOPS], [DOCS].

1. **Story: Monorepo shell (phase 0)**
   - [DEVOPS] Root pnpm workspace, move app to `apps/web`, shared `packages/config`.
   - [DEVOPS] CI on new paths, `ci-ok` required job, Vercel Root Directory switch tested on a preview.
   - [DEVOPS] SessionStart hook and `.claude/hooks` on new paths.
   - [QA] Full e2e and a production smoke check after the switch.
   - [DOCS] CLAUDE.md, README layout.
2. **Story: Shared packages (phase 1)**
   - [BE] `packages/db` (schema, client, scripts).
   - [BE] `packages/contracts` and `packages/domain` with their tests.
   - [FE] `packages/ui` for components both areas render.
   - [QA] `pnpm verify` + e2e unchanged.
3. **Story: Standalone admin app (phase 2)**
   - [FE] `apps/admin` from `/admin` routes, own manifest and login.
   - [FE] Remove admin from `apps/web`, `/admin/*` redirect, drop cross-role proxy code and admin manifest route.
   - [DEVOPS] Vercel project `pt-app-admin`, env vars, Ignored Build Step, CI path filter.
   - [QA] Admin e2e on the new app, trainee e2e unchanged.
4. **Story: NestJS API skeleton (phase 3)**
   - [BE] Nest app, Config, DB module, Health, exception filter with ref ids, Zod pipe, OpenAPI.
   - [BE] `SessionGuard`, roles, `AuthModule` with the DB-backed rate limiter.
   - [DEVOPS] Vercel project `pt-app-api`, Turso integration, schema push moved here, preview DB.
   - [QA] supertest e2e for auth and rate limiting.
5. **Story: Login and sessions through the API (phase 4)**
   - [BE] Token refresh, change password, admin password reset endpoints.
   - [FE] Web and admin login/logout/change-password call the API; typed API client in `packages/contracts`.
   - [QA] Login, lockout, stale-session and refresh e2e for both roles.
6. **Stories: one per module (phase 5)**: Foods, Members, Workouts, Nutrition, Meal plans, Dashboard. Each with:
   - [BE] Endpoints + service + supertest tests.
   - [FE] Switch the app's reads and Server Actions to the API.
   - [QA] Module e2e green, latency check on preview.
7. **Story: Cut over and clean up (phase 6)**
   - [DEVOPS] Remove DB env vars and `@pt/db` from apps, ESLint guard.
   - [DOCS] CLAUDE.md, README (Vietnamese), REVIEW.md, skills paths, release notes.
   - [QA] Full regression and production smoke check.

## 11. Open questions (to ask on the epic in Jira once it exists)

1. Why the split: is a second client (Expo nutrition app, native app) planned? This decides whether option A is worth it over option C.
2. Is pt-app commercial (PTs paid)? Vercel Hobby is non-commercial only; Pro is $20/user/month.
3. Custom domain: buy one now (nicer URLs, enables option B later) or stay on `*.vercel.app` (free)?
4. Admin URL: OK for the admin to move to a new `*.vercel.app` URL, with `/admin/*` on the trainee site redirecting there for a while?
5. What do Vercel preview deploys use as a database today? Recommendation: a separate Turso preview DB.
6. Keep Server Actions as thin wrappers (recommended), or move the apps to client-side fetching?
7. Order: admin split first (recommended), or NestJS first?
8. Versioning: one repo version (recommended) or a version per app?
9. Any deadline, or follow the phases one story at a time?

## 12. Test matrix (for the build phases)

| Area       | Proof                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure rules | Vitest in `packages/domain` (moved tests, unchanged assertions).                                                                                                                                        |
| API        | supertest e2e per module on temp SQLite: auth required, role checks, ownership (trainee A cannot read trainee B), Zod rejects bad input, lockout after 5 failures, stale session after password change. |
| Apps       | Playwright: trainee login and each tab, admin login and each page, preview page, PWA install/offline specs.                                                                                             |
| Deploy     | Preview deploys of all three projects talk to each other; production smoke check after each phase; rollback rehearsed once in phase 3.                                                                  |
