---
name: advisor-delegate
description: Run a large pt-app task with the main session as advisor (plans, decides, reviews every diff, commits) and cheaper subagents doing volume work (Sonnet builds approved steps, Haiku runs checks and searches). Use on "plan this and delegate", "advisor mode", or multi-step work across several files or tickets.
---

# Advisor plans, cheaper models run

The expensive part of the work is judgment, not typing. Keep decisions in the main session; push volume down. Only delegate when the user asked for subagents or the task clearly needs them (they cost time and tokens).

| Role    | Model                       | Does                                                                    |
| ------- | --------------------------- | ----------------------------------------------------------------------- |
| Advisor | main session (e.g. Opus)    | plans, decides, reviews every diff, commits, talks to the user and Jira |
| Builder | `model: sonnet` subagent    | implements one approved plan step                                       |
| Runner  | `model: haiku` subagent     | runs `pnpm test`/`lint`/`typecheck`, searches, reports only failures    |
| Bug     | `bug-investigator` subagent | read-only root cause with `file:line` for a failing test or bug report  |

## Procedure

1. Plan with the user in plan mode (run `grill-me` first if the feature is bigger than a day). Get approval; for a capstone ticket the plan is posted as a comment on the KAN ticket.
2. Split the plan into steps with clear inputs, outputs, the files each may touch and its acceptance check. A step that needs a decision stays with you.
3. For each step, start a builder with the step, the constraints (CLAUDE.md conventions, Vietnamese UI copy in `constants/messages.ts`, `requireAdmin()`/`requireUser()` first, Zod input, additive schema only) and the check. Run independent steps in parallel, each in its own worktree (`isolation: "worktree"`); never let two agents edit the same file.
4. After each step, start a runner to run `pnpm test && pnpm lint && pnpm typecheck` and report **only failures** with file and line.
5. **Review every diff yourself** against the `review-checklist` skill before anything is committed. Send it back with concrete fixes if needed.
6. Commit only after review and green checks, with `honest-commit-push`.

## Rules

- Ask subagents for a conclusion, not a transcript: "find where week math is done and tell me file and line".
- Use read-only Explore subagents for wide searches so the main context stays clean.
- Give every subagent the never-do list: no `.env*`, no db scripts against Turso, no `main`, no force-push, no Claude trailers.
