---
name: pair-feature
description: Build a new feature in five stages with a clear human/Claude split - pin the requirement, study existing code and a reference feature, plan with a gap check, build in stages (data model, API, UI) with verification after each, then test. Use on "add a feature", "build X", "implement this story".
---

# Pair feature workflow

Each stage has an owner. Do not skip ahead: a stage ends only when its exit check passes.

## Stage 1. Pin the requirement (human decides)

Get or confirm: inputs, outputs, edge cases (empty, too long, duplicates, concurrent use), permissions, performance and security needs, and what "done" looks like.

- If the feature is bigger than a day and `grill-me` is available, run it now.
- Otherwise ask at most 5 numbered questions, each with your recommended answer.

Exit check: a short written spec (in the ticket, spec doc or chat) the human has confirmed.

## Stage 2. Understand existing code (Claude)

Delegate to the `code-scout` agent when available, otherwise search yourself. Find out:

- Is there a similar feature? Name the reference files to copy structure from.
- How is related data stored (tables, fields, relations) and accessed?
- Which conventions apply (naming, validation, error handling, auth guards, tests)?

Exit check: a list of reference files and conventions, no code changed yet.

## Stage 3. Plan together (Claude drafts, human approves)

Write the plan in layers: data model, server/API, UI, tests. For each, list files to add or change. Then check the plan for gaps against Stage 1: missing edge cases, permissions, pagination, indexes, migrations, empty and error states. Use plan mode when available.

Exit check: the human approved the plan. Any trade-off choice was put to them with options and a recommendation.

## Stage 4. Build in stages (Claude builds, human reviews)

Build one layer at a time, in this order unless the plan says otherwise:

1. Data model (fields, relations, indexes; schema changes additive).
2. API or server actions (validate input, check permissions, paginate lists).
3. UI components (loading, empty, error states).

After each layer: run the matching tests, lint and typecheck; show a short summary of the diff; fix before moving on. Follow the reference feature's style over your own.

Exit check per layer: checks are green and the human has seen the layer's diff summary.

## Stage 5. Test and verify (human owns, Claude helps)

- Write automated tests for the main flow, edge cases from Stage 1, and permission failures. Use the `safety-net-tester` agent when available.
- Run the full check suite. For UI work, prove it in a browser (`browser-proof` if available).
- Hand the human a manual test list: the 3-6 things they should click or try themselves.

Exit check: all checks green, human ran the manual list or explicitly skipped it.

## Finish

Summarise: what was built, files changed, tests added, what was not done, and anything worth recording with `pair-knowledge-log` (for example an architecture choice made in Stage 3 becomes an ADR).
