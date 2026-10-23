---
name: ai-work-queue
description: Use the Jira KAN board as a work queue for Claude sessions - claim one To Do ticket, plan, fix, verify, then move it to Done, or release it with notes if it cannot be finished. Use on "take the next ticket", "fix from the queue", "drain the queue".
---

# Jira KAN as the AI work queue

Several sessions or worktrees can work the same backlog without colliding. The board (project KAN, board "KAN board", columns To Do / In Progress / In Review / Done) is the source of truth for who is doing what.

## Producers (filing)

- File findings from reviews, features and bugs with the `actionable-ticket` skill: one ticket per finding, de-duplicated, labelled `ai` when Claude may pick it up, plus an area label such as `pt-app`. Split dev work into [BE]/[FE]/[QA] sub-tasks under a parent story. A human confirms each ticket before it enters the queue.

## Consumer loop (fixing)

1. **Pick** the highest-priority To Do ticket labelled `ai` that is unassigned or assigned to the user, whose blockers ("is blocked by" links, earlier waves in the spec) are Done.
2. **Claim** it: move it to **In Progress** and add a comment `claimed by <session/worktree> at <UTC time>`. One session per ticket.
3. **Plan** in plan mode; post the plan as a comment on the ticket and wait for the user's approval. Questions go on the ticket as comments, never only in chat.
4. **Fix** on a branch named after the ticket (`feat/KAN-xx-short-name`), in its own worktree, one concern per PR.
5. **Verify**: `pnpm test && pnpm lint && pnpm typecheck` pass, plus `browser-proof` for UI changes.
6. **Open the PR** (description per `actionable-ticket`, Jira key in title) and move the ticket to **In Review**.
7. **Close** only after the PR is merged and CI is green: move the ticket to **Done**. Move a parent story to Done when all its sub-tasks are Done.
8. **Can't finish?** Release it: move it back to **To Do**, comment what was tried, what blocks it and where the branch is. **Never move an unfinished ticket to Done.**
9. A claim with no activity for 24h is stale; comment before taking it over.

## Rules

- Verify, then close.
- Never take a second ticket while this session holds one.
- Update `docs/specs/<feature>.md` when a ticket answer changes a decision.
