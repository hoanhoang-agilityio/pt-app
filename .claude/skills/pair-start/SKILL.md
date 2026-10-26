---
name: pair-start
description: Start any coding task by naming the project type (new, mature, prototype, maintenance) and the task type (feature, bug, refactor, review), then pick the matching pair-* workflow and agree who decides what. Use at the start of a task, on "where do I start", or when a request is vague.
---

# Pair start: pick the right workflow

The human decides what to build, makes trade-offs and owns quality. Claude executes, finds information and surfaces obvious problems. Treat Claude's output like a fast junior's: useful, never merged unread.

## 1. Classify the project

Decide from the repo (git history, size, tests, README), not by asking, unless it is genuinely unclear.

| Project type | Signals                           | Strategy                                                                                                                                                                   |
| ------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New          | Empty or near-empty repo          | Propose stack, layout and schema; wait for approval; scaffold; then build one module at a time. Write CLAUDE.md conventions on day one.                                    |
| Mature       | Large codebase, established style | Understand before changing. Find a reference feature that already does something similar and copy its structure, naming and file layout. Test neighbours after the change. |
| Prototype    | Throwaway or idea validation      | Speed over polish. Build the thinnest working slice, iterate in small additions, skip heavy tests. Say plainly that it will need a rewrite if it survives.                 |
| Maintenance  | Stable code, mostly fixes         | Smallest safe change, defensive checks, friendly errors, regression test, record the fix in docs/troubleshooting.md.                                                       |

## 2. Classify the task and route

- New feature: run `pair-feature` (if bigger than a day and `grill-me` is available, grill first).
- Bug or error: run `pair-bugfix`.
- Cleanup, duplication, structure or performance without new behaviour: run `pair-refactor`.
- Reviewing a diff or PR: run `pair-review`.
- Something solved that will come back (env issue, tricky fix, architecture choice): run `pair-knowledge-log`.

## 3. Check the request is specific enough

A good request names: the exact error or goal, where (file, route, command), what is expected, and the context. If any is missing, look it up yourself first (logs, repo, tests); ask the human only for what the repo cannot tell you, in one short message.

## 4. State the plan of attack

Before touching code, reply with three lines:

- Project type and task type you picked, and why in a few words.
- The workflow and its first step.
- What you need the human to decide, if anything.

## Ground rules for every workflow

- One thing at a time: split big asks into small steps and finish each before the next.
- Verify promptly: after each file or small group of files, run the relevant test, lint or typecheck before moving on.
- Never claim it works without having run something that shows it.
- Choices with trade-offs (architecture, library, data model) go to the human with 2-3 options and a recommendation.
- Team conventions live in CLAUDE.md; read it first and follow it over your own habits.
