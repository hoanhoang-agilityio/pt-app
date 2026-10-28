# Plan: <feature>

Commit the approved plan-mode output as `docs/specs/<feature>.plan.md`, next to the spec, before implementation starts.

## Source

- Intent: `intent/<date>-<slug>.md`
- Spec: `docs/specs/<feature>.md`
- KAN key: KAN-<n>

## Files that change

- `path/to/file.ts`: what changes and why.

## Order of work

1. Smallest step that can be verified on its own.
2. Next step, and so on. Schema changes are additive and come first.

## Risks

- What could break, who is affected, how it is contained.

## Proof

- Tests that prove it (file or test names), and commands such as `pnpm verify`.
- For UI changes: what to check in the browser (`browser-proof`).

## Deviations

Update this section in the same commit whenever the implementation departs from the plan: what changed and why.
