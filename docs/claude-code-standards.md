# Claude Code working standards for pt-app

How we work with Claude Code on this repo. CLAUDE.md holds the project facts; this page holds the working habits; the procedures are skills in `.claude/skills/`.

The one idea: **put the context in the repo, not in the prompt.** A short prompt ("commit push", "take the next ticket") works because CLAUDE.md, the skills and the hooks carry the rest.

## Standards

### Context

- **Talk like a teammate.** Say what you want and let Claude work out how; ask its opinion; correct plainly.
- **Explained twice, write it down.** A project fact goes in CLAUDE.md, a procedure becomes a skill, a personal preference goes in memory, a rule that must always hold becomes a hook in `.claude/hooks/` (with a test in `.claude/hooks/__tests__/`). Skill: `project-map-refresh`.
- **CLAUDE.md is the project map.** Commands, layout, every skill, conventions, never-do list, and why things were removed. Update it in the same commit that changes a convention.
- **Drafts, not sends.** Claude prepares Slack messages, emails and Jira comments addressed to other people; a human sends anything outward-facing.

### Workflow

- **Grill before you plan** for anything bigger than a day: `grill-me`, decisions recorded in `docs/specs/<feature>.md`.
- **One plan, synced both ways.** The spec in `docs/specs/` owns scope, sequence and decisions; Jira KAN owns status. When one changes, update the other.
- **Design every state before building UI.** The spec lists loading, empty, error and success states; check them in the browser before merging.
- **Plan first, then let it run.** Plan mode (plan approved, for capstone tickets as a Jira comment) before code changes; auto mode for reads, edits and checks.
- **Advisor decides, cheaper models run** when subagents are used: `advisor-delegate`.
- **One workstream, one checkout.** One Story per worktree session and per PR; retire the worktree once the PR is merged.
- **Send the searching to subagents.** Explore for read-only sweeps, `bug-investigator` for a failing test; ask for a conclusion, not a transcript.
- **Board as the work queue**: claim, plan, fix, verify, close or release: `ai-work-queue`.
- **Tickets and PRs a stranger can act on**: `actionable-ticket`.

### Reach

- **Share across sessions through channels**, not one session's head: CLAUDE.md (facts, via git), memory (preferences), Jira (tasks and claims), artifacts (reports and reviews).
- **Capture long output as an artifact**: review reports, before/after screenshots, demo videos.
- **Prove UI in a real browser** before a UI PR: `browser-proof`.

## Guardrails (never relaxed, even in auto mode)

| Rule                     | In pt-app                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Never force-push         | Blocked by the PreToolUse hook; a diverged branch is reported, not overwritten.         |
| Never push to `main`     | Blocked by the hook; every change goes through a PR with green CI.                      |
| Honest commits           | Each message is written from the diff, with the KAN key: `honest-commit-push`.          |
| Verify, then close       | A ticket moves to Done only after its PR is merged with test, lint and typecheck green. |
| Write down why           | Removals and reversals are recorded in CLAUDE.md or the spec, with the date.            |
| Production is off limits | No db scripts against Turso; schema changes stay additive.                              |

## Checklists

### New feature (bigger than a day)

- [ ] `grill-me` done; every decision in `docs/specs/<feature>.md` or written down as an assumption
- [ ] Tickets filed with `actionable-ticket`, split into [BE]/[FE]/[QA] sub-tasks
- [ ] Plan approved before code; ticket moved to In Progress
- [ ] Tests for new logic in the sibling `__tests__/`; `pnpm test && pnpm lint && pnpm typecheck` green
- [ ] `browser-proof` for UI changes, artifact linked in the PR
- [ ] Reviewed with `review-checklist`
- [ ] PR: what and why, how verified with output, screenshots, Jira key, one concern; ticket moved to In Review
- [ ] CLAUDE.md updated in the same commit if a convention changed

### Before commit and push

- [ ] Diff read; no `.env*`, `*.db`, `.next/`, `.playwright-mcp/` or secrets
- [ ] On the ticket branch, not `main`; author is Hoan Hoang
- [ ] One commit per concern; message written from the diff with the KAN key
- [ ] No `Co-Authored-By` or `Claude-Session` lines
- [ ] Checks run; no force-push, no `--no-verify`

### Filing a ticket

- [ ] Duplicate search in KAN done
- [ ] Symptom title, where, repro, expected vs actual
- [ ] Testable acceptance criteria
- [ ] Labels: area (and `ai` if Claude may pick it up)

### Closing a ticket

- [ ] PR merged and CI green
- [ ] Ticket moved to Done; parent moved to Done when all sub-tasks are
- [ ] Unfinished work released to To Do with notes, never closed

### When you correct Claude

- [ ] Will it recur? Save it to memory (personal) or CLAUDE.md (project)
- [ ] Must it hold every time? Make it a hook with a test
- [ ] Explained the same procedure twice? Make it a skill

## Known gaps to watch

- Corrections that are not saved come back; say "remember this".
- A rule that only lives in CLAUDE.md can be skipped; hooks cannot.
- Skills whose output is checked by eye still need automated tests (e.g. Playwright for flows proven by hand).
- Prune merged branches and worktrees.
