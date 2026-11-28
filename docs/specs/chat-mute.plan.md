# Plan: Chat mute (per person)

Written after the build, as the steps were actually done on `feat/mute-notifications`. Three commits, in order: server, admin UI, review fixes.

## Source

- Intent: none (prototype approved by Hoan on 2026-11-28)
- Spec: `docs/specs/chat-mute.md`
- KAN key: none (Hoan builds chat features without Jira tickets)

## Files that change

Schema and rules:

- `db/schema.ts`: new additive table `chatMutes` (owner and target actor keys, nullable `muted_until`, unique owner and target, index on owner).
- `features/chat/utils/mute-rules.ts` (new): durations, `resolveMuteUntil` (08:00 tomorrow from the client offset, -840..720), `isMuteActive`, `toMuteState`, `formatMuteUntil`.

Server:

- `features/chat/services/chat-mutes.ts` (new): set, clear, active lists, owners that muted a target, mutes of an admin's trainees, one chat's state.
- `features/chat/services/chat-mute-actions.ts` (new): `muteContactAction` and `unmuteContactAction` (`requireAdmin()`, Zod, scope check, own row only).
- `features/chat/services/chat-queries.ts`: unread for an admin skips muted rows in the total and the app badge; each row keeps its count and gets a `muted` flag.
- `features/chat/utils/unread-payload.ts`: reads `muted` (true only when exactly true).
- `app/api/chat/unread/route.ts`: `?as=admin` payload carries `muted`.
- `features/chat/services/chat-push.ts`: chat and reaction pushes skip admins who muted the trainee.
- `features/social/services/dm-notify.ts`: DM push skips recipients who muted the sender.
- `features/chat-bubbles/utils/bubble-payload.ts` and `components/BubbleHostInner`: `bubbleMutedKeysFrom`; muted trainee chats do not pop a bubble.
- `features/members/services/member-actions.ts`: deleting a trainee removes mutes set by or on them.

Admin UI:

- `features/chat/components/MuteSheet` (new): five durations in a vaul `BottomSheet`.
- `features/chat/components/MuteChip` (new): chip under the chat header; reopens the sheet.
- `features/chat/components/ChatInfo`: bell button for mute on the chat info page, and the state shown there.
- `features/chat/components/ChatInboxList` and `AdminInbox`: grey pill with a bell-off icon on muted rows; "⋯" button opens the sheet (no long-press, which opens the bubble).
- `features/chat/components/AdminChatThread`: mounts the chip.
- `features/chat/hooks/use-mute-actions.ts` (new): calls the two actions, shows toasts with the error reference id.
- `app/admin/(protected)/users/(list)/page.tsx`: members-list badge skips muted chats (review fix).
- `app/admin/(protected)/users/[id]/messages/(thread)/page.tsx` and `users/[id]/messages/info/page.tsx`: pass the mute state to the chip and the info page.

Strings and constants:

- `features/chat/constants/messages.ts`: `MUTE_MESSAGES`.
- `messages/{vi,en,zh}/chat.json`: `chat.mute` strings. `messages/{vi,en,zh}/errors.json`: `muteChat` error strings.
- `i18n/__tests__/localize-message.test.ts`: covers the new keys.

Tests:

- `features/chat/utils/__tests__/mute-rules.test.ts`, `features/chat/services/__tests__/chat-mutes.test.ts`, `chat-mute-actions.test.ts`, `chat-routes.test.ts` (extended), `unread-payload.test.ts` (extended), `features/chat-bubbles/utils/__tests__/bubble-payload.test.ts` (extended), `features/members/services/__tests__/member-actions.test.ts` (extended).

## Order of work (as built)

1. Server (`976b396`): table and rules, service and actions with tests, unread and push filters, bubble payload, member-delete cleanup.
2. Admin UI (`3823cdc`): sheet, chip, info button, inbox row state and menu, strings in vi, en and zh.
3. Review fixes (`b7a4efc`): members-list badge skips muted chats, toasts show the error reference id, timezone offset capped at the real maximum (720).

## Risks

- A muted chat still shows its unread count, so an admin can miss a message that was not pushed. This is intended (M3); the grey pill is the only signal.
- Expired mutes are not deleted; reads ignore them. The table can grow by one row per admin and trainee pair at most.
- Extra queries on the unread path (mute lookup per admin request). Kept to indexed reads by owner and target.
- Push filters add one query per message send.
- Clock and time zone: "until 08:00 tomorrow" uses the browser's offset. A bad offset is rejected at the boundary (Zod range).

## Proof

- Tests listed in `docs/specs/chat-mute.md`: `mute-rules`, `chat-mutes`, `chat-mute-actions`, `chat-routes`, `unread-payload`, `bubble-payload`, `member-actions`, and the i18n test.
- `pnpm verify` (tests, lint, typecheck) before the PR into `stag`.
- UI check: `browser-proof` on the mute sheet, chip, info button and inbox row. Not run as part of this plan; the UI has no e2e test.

## Deviations

- Plan said nothing about the members-list badge; the review added it (`b7a4efc`).
- The inbox "⋯" button replaced the long-press idea, because a long press opens the chat bubble.
- Known gaps at merge, accepted at approval:
  - The header chip is stale after a timed mute expires, until the page is reloaded.
  - `countUnreadForAdmin` runs extra queries.
  - The monorepo web app and the Expo app are not built with this feature.
