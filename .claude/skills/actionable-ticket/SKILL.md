---
name: actionable-ticket
description: File a bug or feature as an issue (GitHub or Jira) that a stranger or another Claude session can act on cold, interviewing the user until every field is pinned down; also writes PR descriptions to the same standard.
---

# Issues and PRs a stranger can act on

The reader of a ticket is often another Claude session on another machine with none of your context. If it cannot act on the ticket cold, the ticket is not done. Refuse to file a vague ticket: interview the user until every required field is filled.

## Filing an issue (bug or feature)

1. pt-app tracks work in Jira project KAN (one ticket per branch, see CLAUDE.md). Search it for duplicates first; if one exists, add to it instead of filing a new one.
2. Collect every field below. Look up facts yourself (file paths, line numbers, current behaviour); ask the user only for what you cannot find. Ask all missing fields in one round, each with a suggested value.
3. Show the drafted ticket and file it only after the user confirms.
4. Reply with the ticket link.

### Required fields

| Field               | Rule                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Title               | States the **symptom**, not the guessed cause. "Weekly summary omits Sunday workouts", not "Fix date bug". |
| Where               | File and line, or screen / route / endpoint.                                                               |
| Steps to reproduce  | Numbered, from a clean state. (Feature: the user story and context instead.)                               |
| Expected vs actual  | Two separate lines.                                                                                        |
| Acceptance criteria | A checklist someone can test, pass or fail.                                                                |
| Labels              | Area + severity (and `ai` if it goes in the AI work queue).                                                |
| Evidence            | Log excerpt, screenshot, failing test name, when available.                                                |

## Writing a PR description

- **What changed, and why**: one short paragraph, linking the issue.
- **How it was verified**: the commands run and their real output (tests, build, lint); a reviewer should not need to re-run anything to trust it.
- **Screenshots or a GIF** for anything visible.
- **Closes #N** (or the Jira key) so the queue stays true.
- **One concern per PR.** If the diff mixes concerns, propose a split.
- Follow the repo's PR template headings when one exists.

## Rules

- Write tickets and PRs in the language the project requires (default English).
- Never invent reproduction steps or verification output. If something was not verified, say so.
