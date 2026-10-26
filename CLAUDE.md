@AGENTS.md

# PT App

Weekly PT workout app: admins (PTs) assign daily workouts, users log in by name. Next.js 16 App Router + React 19, Drizzle ORM on libSQL (SQLite locally, Turso on Vercel), Tailwind 4, Zod, Vitest. Mobile-first. The README (Vietnamese) has the full feature list.

## Commands

- Install (Node 24, same as Vercel via `engines`): `pnpm install`, then `cp .env.example .env.local`, `pnpm db:push`, `pnpm admin:create`
- Dev: `pnpm dev` (http://localhost:3000, admin at `/admin/login`)
- Before every PR: `pnpm test && pnpm lint && pnpm typecheck`
- Format: `pnpm format` (Prettier; a hook runs `eslint --fix` + Prettier on each file Claude edits)
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
- CI (`.github/workflows/ci.yml`) runs test, lint and typecheck on every PR; keep it green.

## Capstone workflow

- Specs live in `docs/specs/<feature>.md` (decisions, open questions, test matrix); the Jira ticket links to it.
- Ask every question as a comment on the Jira ticket, never in chat; update the ticket and spec when it is answered.
- One Story per worktree session and per PR, plan mode first. Run `/grill-me` before planning a feature, file tickets with `actionable-ticket`.
- Schema changes must be additive (new tables, nullable columns): the Vercel build runs `drizzle-kit push` against production.

## Skills: hoan-dev-skills (`.claude/skills/`)

Working standards and checklists for the set: `docs/hoan-dev-skills.md`.

- `grill-me`: interview in decision rounds before planning a feature bigger than a day.
- `actionable-ticket`: KAN tickets and PR descriptions a stranger can act on.
- `review-checklist`: review a branch or PR before opening or merging it.
- `honest-commit-push`: commit from the diff with the KAN key, checks, push, no force-push.
- `browser-proof`: prove a UI change with the Playwright MCP on a local DB, report in an artifact.
- `ai-work-queue`: claim a KAN ticket, plan, fix, verify, move it across the board or release it.
- `advisor-delegate`: main session plans and reviews; Sonnet builds, Haiku runs checks.
- `project-map-refresh`: keep this file true when a convention changes.

## Skills: ai-pair-workflow (`.claude/skills/pair-*`)

Per-task workflows where the human decides and Claude executes; they call the hoan-dev-skills above where the two meet. Details: `docs/hoan-dev-skills.md`.

- `pair-start`: name the project and task type, pick the workflow below.
- `pair-feature`, `pair-bugfix`, `pair-refactor`, `pair-review`: staged workflows with a verify step after each stage.
- `pair-knowledge-log`: troubleshooting entries, ADRs and saved solutions under `docs/`.
- Agents in `.claude/agents/`: `code-scout` and `first-pass-reviewer` (read-only), `safety-net-tester` (test files only), plus `bug-investigator`.
- Verify hooks in `.claude/hooks/pair/` (tests: `node --test .claude/hooks/pair/__tests__/hooks.test.mjs`).

## Never do

- Never add `Co-Authored-By` or `Claude-Session` lines to commits.
- Never push to `main` or force-push; open a PR.
- Never read, print or commit `.env*` files (only `.env.example`) or any secret.
- Never skip, delete or `.skip` a failing test to get green; fix the cause.
- Never run `db:push`, `db:setup` or scripts against a Turso/production URL.
