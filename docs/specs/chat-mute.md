# Chat mute (per person)

KAN: none (Hoan builds chat features without Jira tickets). Plan: `docs/specs/chat-mute.plan.md`. Prototype approved by Hoan on 2026-11-28: https://claude.ai/artifact/BephvPY9iYyGSMraU3wHEZ

## Goal

An admin (PT or super admin) can mute one trainee's chat, the way Zalo mutes a conversation. A muted chat still collects unread messages on the inbox row, but it no longer adds to the badge counts, pops a bubble or sends a push.

## Decisions

- M1. Scope: the 1:1 chat between an admin and a trainee, plus direct messages. Group chats are out of scope and get no mute control.
- M2. Durations: 1 hour, 4 hours, 8 hours, until 08:00 tomorrow, forever. "Tomorrow 08:00" is computed in the browser's time zone, sent as the offset from `Date#getTimezoneOffset()` and validated to -840..720 minutes. "Forever" stores no end. Turning the mute back on is always possible.
- M3. What a muted chat keeps and loses:
  - Kept: the unread count on the inbox row, shown as a grey pill with a bell-off icon.
  - Left out: the header total, the members-list badge, the app and icon badge count, the bubble pop, and every push (chat message, chat reaction, DM).
- M4. Ownership: an admin can only change their own mutes. The stored owner is always the signed-in admin's actor key (`admin:<id>`). Actor keys leave room for trainees to mute later, but trainees have no control in this release.
- M5. An expired mute reads as unmuted. Nothing deletes it; no cron job runs.
- M6. Deleting a trainee removes every mute set by or on that trainee.

## Data model (additive only)

New table `chat_mutes`:

| Column        | Type                   | Notes                                  |
| ------------- | ---------------------- | -------------------------------------- |
| `id`          | integer, autoincrement | primary key                            |
| `owner_key`   | text, not null         | actor key of the admin who muted       |
| `target_key`  | text, not null         | actor key of the trainee (`user:<id>`) |
| `muted_until` | timestamp, nullable    | null = forever; a past value = expired |
| `created_at`  | timestamp, not null    | default `unixepoch()`                  |

- Unique index on `(owner_key, target_key)`, one row per owner and target.
- Index on `owner_key`.
- No foreign keys (the codebase keeps them off); member deletion removes rows explicitly.

## Behaviour and code

- Server actions in `features/chat/services/chat-mute-actions.ts`:
  - `muteContactAction`: `requireAdmin()`, Zod input, the trainee must pass `isUserInAdminScope`; a missing trainee and an out-of-scope trainee get the same answer, and nothing is stored.
  - `unmuteContactAction`: `requireAdmin()`, Zod input, removes only the caller's own row; idempotent.
- Errors go through `withResultErrorHandling` (`services/action-errors.ts`).
- Service `features/chat/services/chat-mutes.ts`: set, clear, list active mutes, the owners that muted a target (one query for push filters), the trainee ids an admin muted, and one chat's state.
- Pure rules `features/chat/utils/mute-rules.ts`: durations, `resolveMuteUntil`, `isMuteActive`, `toMuteState`, `formatMuteUntil`.
- `GET /api/chat/unread?as=admin` adds `muted` (and the end, where set) to each row; the total and `appBadge` skip muted rows.
- Push filters in `chat-push.ts` and `dm-notify.ts` skip recipients who muted the sender.
- The bubble payload leaves muted trainee chats out (`bubbleMutedKeysFrom`).

## UI

- `MuteSheet`: a bottom sheet (vaul `BottomSheet`) with the five durations.
- `MuteChip`: a chip under the chat header while a chat is muted; tapping it reopens the sheet.
- Bell button on the chat info page.
- "⋯" button on inbox rows. No long-press, because a long press already opens the chat bubble.
- Strings under `chat.mute` in `messages/{vi,en,zh}/chat.json` (vi is the default). UI copy is Vietnamese.

## Test matrix

| Rule                                          | Test                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| M2 durations, tomorrow 08:00 by offset        | `features/chat/utils/__tests__/mute-rules.test.ts` (`resolveMuteUntil`, input schemas)          |
| M5 expired reads as unmuted, state and labels | `mute-rules.test.ts` (`isMuteActive`, `toMuteState`, `formatMuteUntil`)                         |
| M1, M4, M2 actions: own row, scope, input     | `features/chat/services/__tests__/chat-mute-actions.test.ts`                                    |
| Upsert, clear, active lists, one lookup       | `features/chat/services/__tests__/chat-mutes.test.ts` ("mute rows")                             |
| M3 unread row, total, badge, expiry           | `chat-mutes.test.ts` ("unread for a muting admin"), `chat-routes.test.ts` (`?as=admin`)         |
| M3 chat push and DM push                      | `chat-mutes.test.ts` ("chat push to a muting admin", "direct message push")                     |
| M3 bubble pop                                 | `features/chat-bubbles/utils/__tests__/bubble-payload.test.ts` (`bubbleMutedKeysFrom`)          |
| Unread payload `muted` flag                   | `features/chat/utils/__tests__/unread-payload.test.ts`                                          |
| M6 deleting a trainee                         | `features/members/services/__tests__/member-actions.test.ts` ("removes the notification mutes") |
| UI strings in vi, en and zh                   | `i18n/__tests__/localize-message.test.ts`, messages test                                        |

Not covered by tests: the sheet, chip and inbox row behaviour in a browser. Use `browser-proof` before any further UI change.

## Open questions

None blocking. Known follow-ups, accepted at approval:

- The header chip stays on screen after a timed mute expires, until the page is reloaded.
- `countUnreadForAdmin` runs extra queries to read the mute state.
- The monorepo web app and the Expo app are not built with this feature.
- Trainees cannot mute yet (the actor keys already allow it).
