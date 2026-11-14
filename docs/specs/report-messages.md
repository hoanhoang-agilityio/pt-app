# Report chat messages (PR 2 of the moderation work)

Owner-approved. No Jira key. Builds on `feat/admin-block-user` (PR 1: `features/restrictions`, `BlockUserSheet`).

## Decisions

1. **Long-press "Báo cáo"** in `MessageActionsSheet`, only on messages from the other side, never for super admins (they read every chat), never on unsent or hidden messages. Trainee reports messages from their PT or a super admin. A PT reports trainee messages in conversations they can access (`canAdminAccessUser`: workspace scope and hidden-trainee rule). The server re-checks all of it in `createReport` (`canReport`, kind `message`); a missing, unsent, hidden or foreign message answers `not_found`.
2. **Reasons.** All reports (post, comment, user, message) send a required `reasonCode` (spam, harassment, inappropriate, scam, other) plus an optional note (`reason`, unchanged column). `ReportSheet` shows the radio list and note and is reused for the message target. Old rows keep `reasonCode = null` and display as "no reason chosen".
3. **Schema (additive only).** `social_reports.target_kind` gains `message` (target_id = `chat_messages.id`); new nullable `reason_code` text column; `resolution` gains `hidden`. Text enums in SQLite need no migration; the nullable column is added by `drizzle-kit push`.
4. **Duplicates.** An open report by the same reporter on the same target stays a no-op (no row, no push).
5. **Admin queue** (`/admin/reports`, super admin only). Message reports show sender, preview (text, or sticker/photo label), the conversation's trainee, reason label and note, and a link to the admin chat at that message (`?m=<id>` jump already exists). Buttons: Keep (`kept`), Hide (`hidden`), Hide + block (hide, resolve, open `BlockUserSheet`; only when the sender is a trainee). Resolving closes every open report on the same target.
6. **Hide mechanism.** No hide action existed (`chat_messages.hidden_by_admin_id` was unused). `hideMessageByAdmin` sets it, bumps the conversation change cursor and publishes a message update. Readers treat a hidden message exactly like an unsent one (redacted in `hydrateMessages`, excluded from search, gallery, unread and inbox preview, no react/edit/unsend). The row (and a photo's bytes) stays as evidence.
7. **Notify super admins.** A new report (any kind) sends one web push to every super admin device in the recipient's language: "Báo cáo mới: <kind>", opening `/admin/reports`. Never on duplicates. Failures are logged, never thrown.
8. **Entry point count.** The admin home "Báo cáo" tile already shows `countOpenReports()` (capped at 99+); unchanged.
9. Restricted trainees can still report: `restrictionErrorFor` is not applied.

## Test matrix

| Case                                                                                     | Test                             |
| ---------------------------------------------------------------------------------------- | -------------------------------- |
| Trainee reports PT message                                                               | `social-report-messages.test.ts` |
| Own message refused                                                                      | same                             |
| Message in another trainee's conversation refused                                        | same                             |
| PT outside the workspace refused                                                         | same                             |
| Super admin refused                                                                      | same                             |
| Hidden / unsent message refused, missing id refused                                      | same                             |
| Duplicate is a no-op (one row, one push)                                                 | same                             |
| reasonCode required and validated (schema)                                               | same                             |
| Resolve `hidden` sets `hidden_by_admin_id`, closes all open reports, redacts for readers | same                             |
| `hidden` on a non-message report refused                                                 | same                             |
| Push goes to super admins only, once per new report                                      | same                             |
| Queue lists message report with preview, sticker label, trainee, reason code, link       | same                             |
| Restricted trainee can still report                                                      | same                             |
