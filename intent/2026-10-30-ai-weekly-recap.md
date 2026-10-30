# Intent: AI weekly recap for the PT

- **Author:** Hoan (drafted by Claude from the "Building with the Claude API" course thread)
- **Status:** draft
- **KAN key:** KAN-65

## Problem

At the end of a week the PT opens each member's Summary tab and reads the numbers (completion, logged sets, macros, weight) one by one to decide what to change next week. With several members this takes time, and patterns across the numbers (for example "trained every day but protein is low and weight is flat") are easy to miss.

## Proposed outcome

On the member Summary tab the PT presses one button and, within about ten seconds, reads a short Vietnamese recap of the selected week and two or three concrete suggestions for next week. The numbers on the page stay the source of truth; the recap only reads them.

## Affected users and systems

- Admins (PTs): new card on `/admin/users/[id]/summary`.
- Trainees: not affected (they never see AI output in v1).
- New external dependency: the Claude API (Anthropic), behind a new optional env var `ANTHROPIC_API_KEY`.
- Tables: read-only use of the existing tables; no schema change.

## Constraints

- No schema change (nothing is stored in v1).
- Vietnamese UI copy and recap text; code, docs and commits in English.
- Cost: on demand only, a small model, no calls from CI or unit tests.
- The feature is invisible when the key is missing, so local dev and preview deploys keep working.
- Trainee data sent to the API is limited to what the recap needs: no names, only the week's numbers.

## Open questions

Asked as comments on KAN-65; answers noted in `docs/specs/ai-weekly-recap.md`.

## Out of scope

- Trainee-facing AI, chat, or AI-generated workout plans.
- Storing or caching recaps, scheduled or emailed recaps.
- Tool use, RAG or MCP (possible follow-ups from the same course).
