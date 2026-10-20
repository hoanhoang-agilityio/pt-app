@AGENTS.md

# PT App

Weekly PT workout app: admins (PTs) assign daily workouts, users log in by name. Next.js 16 App Router + React 19, Drizzle ORM on libSQL (SQLite locally, Turso on Vercel), Tailwind 4, Zod, Vitest. Mobile-first. The README (Vietnamese) has the full feature list.

## Commands

- Install: `npm install`, then `cp .env.example .env.local`, `npm run db:push`, `npm run admin:create`
- Dev: `npm run dev` (http://localhost:3000, admin at `/admin/login`)
- Before every PR: `npm test && npm run lint && npm run typecheck`
- Format: `npm run format` (Prettier; a hook runs `eslint --fix` + Prettier on each file Claude edits)
- Local-only setup steps (GitHub app, notifications, exercises): `docs/claude-code-setup.md`

## Layout

- `app/`: routes only, thin; compose features. `(user)/(protected)` and `admin/(protected)` layouts guard access.
- `features/<name>/{components,hooks,services,utils,constants,types}`: auth, members, workouts, dashboard, nutrition.
- `components/` shared UI, `services/` session/guards/env/logger, `db/schema.ts` Drizzle schema, `utils/` pure helpers.
- Tests: `__tests__/*.test.ts` next to the code they cover (pure utils and services).

## Conventions

- Import via `@/`; ESLint enforces sorted import groups and braces on every `if`/`for` body.
- Components live in `PascalCase/index.tsx`; hooks are `use-kebab-case.ts`.
- Every admin server action calls `requireAdmin()` first; user actions call `requireUser()`. Validate input with Zod.
- Errors go through `services/action-errors.ts`: production shows only a generic message plus a reference id.
- UI copy is Vietnamese; code, comments, commits, PRs and Jira tickets are English.
- One KAN ticket per branch, key in the branch name and commit subject, e.g. `fix(KAN-14): ...`.

## Never do

- Never add `Co-Authored-By` or `Claude-Session` lines to commits.
- Never push to `main` or force-push; open a PR.
- Never read, print or commit `.env*` files (only `.env.example`) or any secret.
- Never skip, delete or `.skip` a failing test to get green; fix the cause.
- Never run `db:push`, `db:setup` or scripts against a Turso/production URL.
