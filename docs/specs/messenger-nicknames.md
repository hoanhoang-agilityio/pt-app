# Messenger-style shared nicknames in chat

No Jira ticket yet (approved by the product owner in chat). Supersedes `docs/specs/private-nicknames.md` INSIDE chat only. Origin: KAN-141 (`docs/specs/chat-ux-v2.md` D1 and D2), which this restores with the table `chat_nicknames`.

## Decisions

- N1. A nickname belongs to ONE conversation (one trainee with the PT side) and every member of it sees the same one. Keys in `chat_nicknames.target_key`: `user` (the conversation's trainee), `pt` (the PT side as a whole) and `admin:<id>` (one PT). `set_by_key` is `user` or `admin:<id>`.
- N2. Any member may set or clear the nickname of ANY member, their own included. A trainee renames the PT side, a PT and themselves; an admin in the conversation renames the trainee, any PT and themselves.
- N3. Server checks, in this order: session (`requireUser` / `requireAdmin`), the conversation (a trainee always acts in their own; an admin names it by id and passes `requireAdminForUser`, so a PT outside the trainee's workspace gets not found), the chat lock (`CHAT_LOCKED`), then the target: `user` and `pt` always belong to the conversation, `admin:<id>` must be an existing admin who may work with the conversation's trainee (`isUserInAdminScope`), otherwise `ADMIN_NOT_FOUND`.
- N4. Validation with Zod (`nicknameSchema` in `features/chat/utils/chat-rules.ts`, built on `aliasValueSchema`): trimmed, whitespace collapsed, 1 to `ALIAS_MAX_LENGTH` (30) characters counted as code points, no control characters. Blank = clear (the row is deleted). Saving the stored value again is a no-op.
- N5. Silent. No system message in the chat, no push. The change only calls `bumpConversationChange` + `publishProfileUpdate` (the existing `done()` in `chat-profile.ts`) so the other members' screens refresh the names.
- N6. Precedence inside chat: shared conversation nickname, else real name. A viewer's private alias (`contact_aliases`) is no longer used in chat.
- N7. Outside chat nothing changes: social feed, comments, profiles, friend lists, admin member list, dashboard, admin trainee pages (week, summary, preview, nutrition), social DMs and notifications keep the private aliases and their UI.
- N8. No destructive schema change. `chat_nicknames` is live again (its schema comment is updated); `contact_aliases` and its data stay.
- N9. Group chats (`features/chat-groups`) are untouched: they have their own conversation model (group id, member actor keys), and their member names keep using the viewer's private aliases. Moving them is a separate story.

## Where the shared nickname is used (chat surfaces)

Thread header and message sender names, chat info page and customise panel (two fields: the other person and yourself), message search, reactors sheet, chat bubbles panel (`bubble-meta.ts`), admin inbox and hidden-trainee list (`listTraineeNicknames`), admin and trainee thread payloads (`loadChatProfile(conversationId)` is the single source), and chat push titles (message and reaction pushes read `chat_nicknames` of the conversation).

## Obsolete

- Private aliases inside chat: `aliasesToConversationNicknames`, `conversationKeyToTarget`, the per-recipient push title grouping (`loadAliasesForOwners` / `loadAliases` in `chat-push.ts`), `reactorKey` as an account key.
- The one-time `chat_nicknames` -> `contact_aliases` migration (`legacy-nicknames-migration.ts`, `mapLegacyNickname`) and its call in `scripts/setup-database.ts`. The script runs on every build and the migration EMPTIED `chat_nicknames`; keeping it would copy and delete every nickname set from now on. It is removed, so nothing re-copies. Rows that survived in `chat_nicknames` (a database that never ran the migration) simply show as shared nicknames again, their original meaning. Data already moved to `contact_aliases` stays there for use outside chat.

## Server API

- `setNicknameAction({ target, nickname })` (trainee) and `adminSetNicknameAction({ conversationId, target, nickname })` (admin) in `features/chat/services/chat-profile-actions.ts`; `target` is `"user" | "pt" | "admin:<id>"`, `nickname` `""` clears. Result `{ status: "success", profile } | { status: "error", message }`.
- `setConversationNickname(conversationId, setByKey, input)` and `loadChatProfile(conversationId)` (no viewer key any more) in `features/chat/services/chat-profile.ts`.
- `listTraineeNicknames(userIds)` in `chat-queries.ts` (target `user` per trainee).
- `ChatInfo` / `ChatCustomizePanel` take `selfName`; `AliasField` takes an optional `hint`.

## Test matrix

| Case                                                                                          | Test                                                                                    |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Member sets another member's and their own nickname, both directions, `set_by_key` recorded   | `chat-profile.test.ts` "nicknames"                                                      |
| Trainee cannot reach another trainee's conversation                                           | same, "never lets a trainee reach another trainee's conversation"                       |
| PT outside the workspace is rejected as a non-member                                          | same, "rejects a PT outside the trainee's workspace"                                    |
| Target outside the conversation (unknown admin, admin of another workspace) rejected          | same, "rejects an admin target..." and "does not exist"                                 |
| Blank clears; no-op does not bump                                                             | same, "treats blank input as clear", "bumps the change cursor ... once per real change" |
| 30 characters ok, 31 rejected, control characters and bad targets rejected                    | same, max length and `it.each` bad input                                                |
| Locked chat is read-only                                                                      | same, "is read-only while the chat is locked"                                           |
| Silent: no message, no push, one profile update per change                                    | same, "is silent"                                                                       |
| Both sides get the same nicknames and ignore private aliases; other conversations do not leak | `chat-profile.test.ts` "payload"                                                        |
| Inbox, hidden list and bubbles show the shared nickname, not the private alias                | `chat-queries.test.ts`, `chat-hidden.test.ts`, `bubble-routes.test.ts`                  |
| Message and reaction push titles use the shared nickname                                      | `chat-push.test.ts`, `chat-reaction-push.test.ts`, `chat-message-actions.test.ts`       |
| Settings targets for each viewer                                                              | `chat-settings.test.ts`                                                                 |
| Private aliases outside chat unchanged                                                        | `getTraineeDisplayName` test, `social-aliases.test.ts`                                  |

## Plan

1. Rules and service: `nicknameSchema`, `setConversationNickname`, actions, `loadChatProfile(conversationId)` reads `chat_nicknames`.
2. Surfaces: inbox, hidden list, bubbles, push titles, callers of `loadChatProfile`.
3. UI: customise panel with two shared fields; vi/en/zh strings.
4. Remove the migration and the dead alias helpers; update the schema comment.
5. Tests (above), `pnpm verify`.

Risks: the Vercel build runs `scripts/setup-database.ts`, so the migration call had to go in the same release or it would delete live nicknames. `e2e/chat-settings.spec.ts` still describes the private-alias panel and needs a follow-up (not run here).

## Deviations

None yet.
