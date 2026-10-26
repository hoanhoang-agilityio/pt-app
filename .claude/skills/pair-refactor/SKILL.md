---
name: pair-refactor
description: Refactor safely - agree the goal and scope, plan with a risk assessment, write characterization tests before touching code, refactor in small verified steps, then prove behaviour is unchanged. Use on "refactor", "clean up", "remove duplication", "restructure", or performance work without new features.
---

# Pair refactor workflow

A refactor changes structure, never behaviour. The tests written first are the proof.

## Stage 1. Goal and scope (human decides)

Agree in writing:

- The problem: duplication, messy structure, or performance (with a number to beat).
- The scope: which files or modules are in, which are explicitly out.
- Acceptable risk: can public interfaces change? Is a feature flag or staged rollout needed?

## Stage 2. Plan and risk (together)

Claude analyses the code (duplicated logic, call sites, coupling), proposes a target shape, and lists risks: callers outside the scope, behaviour hidden in the duplicated copies (each copy may differ slightly), performance changes, migrations. The human approves the plan.

## Stage 3. Safety net (Claude, before any refactor)

- Check existing coverage of the code in scope.
- Write characterization tests that pin current behaviour, including the odd cases each duplicated copy handles differently. Use the `safety-net-tester` agent when available.
- Run them green on the current code and commit them on their own.

Do not start Stage 4 until this commit exists.

## Stage 4. Refactor in small steps (Claude builds, human verifies)

Typical order: extract the shared function or module, switch one call site, run tests, switch the next, run tests, then remove the old copies. One step per commit when practical. If a test fails, stop and fix or revert the step; never edit a characterization test to make it pass unless the human agrees the old behaviour was a bug.

## Stage 5. Verify (human owns)

- Full test, lint and typecheck suite green.
- Manual check of the key user flows touched.
- Show the measurable gain: lines removed, duplicate copies merged, or the timing before and after.

## Finish

Report the goal, what changed, tests added, the gain, and anything deferred. If the refactor set a new pattern, record it with `pair-knowledge-log` (ADR) and update CLAUDE.md conventions.
