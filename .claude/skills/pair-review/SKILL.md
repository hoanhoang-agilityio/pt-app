---
name: pair-review
description: Review a diff or PR in two passes - Claude summarises the change and checks the mechanical issues (security, performance, obvious bugs, style), then hands the human a short list of judgment questions (business logic, edge cases, alternatives, tests) and drafts the feedback. Use on "review this PR", "review my diff", or before merging.
---

# Pair review workflow

Claude does the mechanical pass; the human does the judgment pass. Never approve or merge on Claude's pass alone.

## Pass 1. Understand the change (Claude)

Get the diff (`git diff <base>...HEAD` or the PR). Summarise in 3-5 lines: what it does, why (from the ticket or PR body), and the main files changed. Flag scope creep: changes unrelated to the stated goal.

## Pass 2. Mechanical checks (Claude)

Delegate to the `first-pass-reviewer` agent when available. If the project has its own review checklist skill (for example `review-checklist`), apply it too. Check at least:

- Security: injection (string-built SQL, shell, HTML), XSS from unescaped input, missing auth or permission checks, secrets in code or logs.
- Performance: queries in loops (N+1), missing pagination or indexes, unbounded memory, leaks.
- Obvious bugs: null or undefined paths, off-by-one, wrong conditions, swallowed errors, races.
- Style and conventions: naming, structure and patterns per CLAUDE.md.
- Tests: does the change come with tests, and do they run green?

For every finding: `file:line`, what is wrong, a concrete failure scenario, the fix, and severity (blocker, should fix, nit). Verify each finding against the code before reporting; drop what you cannot back up.

## Pass 3. Judgment questions (human)

Give the human at most 5 questions Claude cannot answer alone, for example:

- Does this match the business rule for <case>?
- Is <edge case> possible in real data?
- Would <alternative> be simpler here?
- Is a test needed for <path>?

## Pass 4. Feedback (human decides, Claude drafts)

Draft review comments from the confirmed findings and the human's answers. Each comment says what to change, why, and a suggested fix. Post nothing until the human approves the draft.

## Output

Summary, findings list (most severe first), judgment questions, then one line: ready to merge, or not and why.
