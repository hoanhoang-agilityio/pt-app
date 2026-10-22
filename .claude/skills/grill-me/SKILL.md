---
name: grill-me
description: Interview the user in rounds of decision questions, each with a recommended answer, before planning any feature bigger than a day. Use on "/grill-me", "grill me", or before plan mode on a non-trivial feature.
---

# Grill me before we plan

Goal: by the end, nothing about the feature is silently assumed. Only then move to plan mode, then build.

## Procedure

1. **Restate the idea** in one or two sentences and confirm the goal (what "done" looks like for the user).
2. **Map the decision tree.** List every decision the feature depends on: scope, data definitions, edge cases, UX states (loading, empty, error, degraded), permissions, migration, rollout, tests. Note which decisions depend on others.
3. **Look up facts yourself.** Anything answerable from the repo, docs, tickets or logs is not a question for the user. Delegate wide searches to a read-only subagent (Explore) and keep only the conclusion.
4. **Ask the whole frontier each round.** The frontier is every open decision whose prerequisites are already answered. Number them Q1, Q2, ... and give each:
   - the question, in one line
   - your recommended answer, prefixed with `➡️`
   - one line of why, only when it is not obvious
     The user can then reply tersely: "Q1 yes, Q2 no, rolling 7 days".
5. **Record answers** in a running decision log (in `docs/specs/<feature>.md` under Goal, Decisions, Open questions for the client, Out of scope). Accept the recommendation when the user says "ok" / "default".
6. **Repeat** until the frontier is empty. Flag any question the user cannot answer: those are the risks that would bite mid-build; turn each into an explicit assumption or a spike.
7. **Hand off** with a short summary: decisions taken, open assumptions, out-of-scope items. Then enter plan mode and write the plan from that summary.

## Rules

- Decisions go to the user; facts do not.
- Never more than ~7 questions per round; split a bigger frontier by priority.
- Every question carries a recommended answer. A question without a recommendation is homework for the user.
- Do not start editing code while grilling.
- Use it for any feature bigger than a day; skip it for one-line fixes.

## Example round

```
❓ Q1 Denominator: every document on the site, or only the ones we found?
➡️ Only the ones found; report misses as their own number.
❓ Q2 Per run, or a rolling average?
➡️ Per run, with a 7-day rolling line on the chart.
```
