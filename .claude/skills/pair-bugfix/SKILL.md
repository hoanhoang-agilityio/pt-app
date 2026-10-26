---
name: pair-bugfix
description: Fix a bug in five stages - gather facts, locate, find the root cause by tracing the data flow, apply the smallest safe fix with a regression test, then verify and hunt for the same bug elsewhere. Use on a bug report, error message, failing test, or "fix this".
---

# Pair bugfix workflow

Never patch the symptom before the root cause is named.

## Stage 1. Gather facts (human provides, Claude collects)

Collect before reading code:

- The exact error message or wrong behaviour (copy, do not paraphrase).
- Reproduction steps, and how often it happens.
- When it started (a deploy, a dependency bump, a data change); check `git log` around that date yourself.
- Who and what is affected.

If the human gave only "it's broken", look in logs, the console, CI and recent commits first, then ask one message for whatever is still missing.

## Stage 2. Locate (Claude)

Find the code that produces the error. Use the `bug-investigator` or `code-scout` agent when available so the search stays out of the main context. Output: the suspect files with `file:line`, and the likely causes ranked.

## Stage 3. Root cause (together)

Trace the bad value backwards: where does it come from, and under which conditions is it missing or wrong? Write the root cause as one sentence: "X happens because Y when Z." Reproduce it with a failing test or a scripted repro before fixing.

If two causes are plausible, say so and design the repro to tell them apart. Do not fix both "just in case".

## Stage 4. Fix (Claude builds, human reviews)

- Smallest change that removes the root cause.
- Add defensive checks at the boundary where bad data enters, and a user-friendly message instead of a crash.
- Keep the failing test from Stage 3; it must now pass.
- No refactors mixed in; note them for later.

## Stage 5. Verify (human owns)

- Re-run the original repro steps and the new test.
- Run the full test, lint and typecheck suite.
- Search for the same pattern elsewhere (same API misuse, same missing check) and list the hits; fix them only if the human agrees.

## Finish

Report: root cause sentence, fix, test added, sibling hits. If the cause was environmental or likely to recur, add an entry with `pair-knowledge-log` (troubleshooting).
