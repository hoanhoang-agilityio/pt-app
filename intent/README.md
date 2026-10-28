# Intents

An intent is the first artifact of every change: the idea, ticket or incident, written in the originator's own words before anyone designs a solution. It says what hurts and what "better" looks like, not how to build it.

- **Who writes it:** anyone (PT, trainee, dev, BA). Claude can draft one from a brainstorm or an incident thread; the originator then corrects it.
- **Naming:** `intent/YYYY-MM-DD-<slug>.md`, for example `intent/2026-10-28-copy-week-warning.md`. Start from `intent/TEMPLATE.md`.
- **Status flow:** `draft` (open in a PR) -> `accepted` (merged) or `closed` (merged or dropped with a one-line reason).
- **Jira:** the KAN ticket is the tracking record (comments, questions, board state). The intent file holds the KAN key so the two stay linked, and the ticket links back to the file.
- **What follows:** an accepted intent is followed by a spec in `docs/specs/<feature>.md` (decisions, open questions, test matrix) and then the approved plan in `docs/specs/<feature>.plan.md` (template: `docs/specs/PLAN_TEMPLATE.md`). Code comes after the plan.

Small fixes (a typo, a one-line bug) can skip the intent; the KAN ticket is enough.
