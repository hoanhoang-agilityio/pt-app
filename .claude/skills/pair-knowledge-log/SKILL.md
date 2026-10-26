---
name: pair-knowledge-log
description: Keep the project's knowledge base current - add troubleshooting entries (problem, cause, fix), architecture decision records, and saved solutions under docs/, and promote lasting conventions into CLAUDE.md. Use after a tricky fix, an environment problem, an architecture choice, or on "remember this", "write an ADR", "log this fix".
---

# Pair knowledge log

Solved once should mean solved for every later session. Pick the right file, write the entry, link it.

## Which file

| What happened                                                                       | Where it goes                                      |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| Something broke and the cause was found (env, setup, a feature bug likely to recur) | `docs/troubleshooting.md`                          |
| A choice between options with lasting consequences (library, data model, structure) | `docs/decisions/NNNN-short-title.md` (ADR)         |
| A non-obvious solution worth reusing (query rewrite, pattern, prompt)               | `docs/solutions/short-title.md`                    |
| A rule every session must follow                                                    | CLAUDE.md (use `project-map-refresh` if available) |

Create the file or folder if it does not exist. Check for an existing entry first and update it rather than adding a duplicate.

## Templates

### Troubleshooting entry (append under "Environment" or "Features")

```markdown
### <Symptom as the user sees it>

- **Cause:** <one sentence>
- **Fix:** <steps or the change, with file paths>
- **Seen:** <date>, <ticket or PR>
```

### ADR (`docs/decisions/NNNN-title.md`, next free number)

```markdown
# NNNN. <Decision title>

- **Status:** proposed | accepted | superseded by NNNN
- **Date:** <YYYY-MM-DD>

## Context

<the problem and constraints>

## Options

<2-3 options considered, one line each>

## Decision

<what was chosen>

## Rationale

<why this option over the others>

## Consequences

<what gets easier, what gets harder, follow-ups>
```

### Solution (`docs/solutions/title.md`)

```markdown
# <Problem in one line>

## Problem

<context and the symptom, with numbers if any>

## Solution

<the change, with a short code sample>

## Result

<measured outcome, for example "query 2000 ms -> 50 ms">
```

## Rules

- Write from facts in this session (errors, diffs, measurements), never from memory or guesses.
- Keep entries short; link the PR or ticket for detail.
- Never write secrets, tokens, internal URLs with credentials, or personal data.
- An ADR that the human has not confirmed stays `proposed`.
- When a troubleshooting entry turns into a rule (third time it happens), promote it to CLAUDE.md.
