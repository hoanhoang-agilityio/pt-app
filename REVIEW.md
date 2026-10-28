# Review guide

Read by Claude when it reviews a PR in this repo. Human reviewers can use it too. Known false positives: [docs/review-false-positives.md](docs/review-false-positives.md). Do not re-raise anything listed there.

## Passes

Tag every finding with the pass that found it: `[Bugs]`, `[Security]` or `[Compliance]`.

1. **Bugs:** logic errors, wrong data, unhandled empty or failure cases, broken behavior for existing users.
2. **Security:** data leaks, missing authorization, unvalidated input, secrets in code or logs.
3. **Compliance:** the change matches the spec and plan in `docs/specs/` (`<feature>.md` and `<feature>.plan.md`, including Deviations) and the conventions in `CLAUDE.md`:
   - admin server actions call `requireAdmin()` first, user actions call `requireUser()` first;
   - input is validated with Zod;
   - errors go through `services/action-errors.ts`;
   - schema changes are additive (new tables, nullable columns);
   - UI copy is Vietnamese, code, comments and commits are English;
   - tests are not skipped, weakened or deleted to get green.

## Severity

- **Important:** breaks behavior, leaks data, or breaches policy (a convention above, the spec, the Never-do list).
- **Nit:** style, naming, taste. Report at most 5 Nits; for the rest, give only a count ("and 7 more nits").

## Do not report

- Generated files: `.next/`, `next-env.d.ts`, drizzle generated output, `pnpm-lock.yaml`.
- Anything CI already enforces: lint, Prettier formatting, typecheck, failing tests.
- Entries in `docs/review-false-positives.md`.

## Output

Important findings first, each with `file:line`, its pass tag, and a one-line fix. Then the Nits and the count. If there is nothing Important, say so.
