# Plan: report-messages

## Source

- Intent: owner-approved request (no intent file)
- Spec: `docs/specs/report-messages.md`
- KAN key: none

## Files that change

- `db/schema.ts`: `socialReports` gets `message` target, nullable `reasonCode`, `hidden` resolution.
- `features/social/constants/social.ts`, `utils/friend-rules.ts`: reason codes, schemas.
- `features/social/services/report-mutations.ts`: message access check, reasonCode, push on new report, `hidden` resolution.
- `features/social/services/report-push.ts` (new): super admin push.
- `features/social/services/report-queries.ts`, `types/social.ts`: message rows in the queue.
- `features/chat/services/chat-moderation.ts` (new) plus filters in chat-queries/search/gallery/mutations: hide mechanism.
- `features/social/components/ReportSheet`, `ReportActions`; `features/chat/components/MessageActionsSheet`, `ChatThread`; `app/admin/(protected)/reports/page.tsx`, admin messages page (viewer `isSuperAdmin`).
- `messages/{vi,en,zh}/{social,chat,adminPages,push}.json`.

## Order of work

1. Schema and constants (additive).
2. Services: access check, create, push, resolve, hide, queue.
3. UI: sheet reasons, long-press item, queue buttons.
4. Tests, `pnpm verify`.

## Risks

- Existing callers of `createReport` now need `reasonCode`: all updated, tests adjusted.
- Hidden redaction touches shared message reads: covered by the existing chat tests plus new ones.
- Push must never fail the report: wrapped in try/catch, scheduled with `after()`.

## Proof

- `features/social/services/__tests__/social-report-messages.test.ts`, `social-friends.test.ts`, messages i18n test, `pnpm verify`.

## Deviations

- The spec said to reuse an existing hide action; none existed, so `hideMessageByAdmin` was added.
