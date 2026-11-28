# Plan: Swipe to reply

KAN: none. Approved by Hoan on 2026-11-28 (prototype https://claude.ai/artifact/JdPAoqJiBnLCE9kVbenR2T).

## Source

- Intent: none (built from the spec directly)
- Spec: `docs/specs/swipe-reply.md`
- KAN key: none

## Files that change

- `features/chat/utils/swipe-reply.ts` (new): constants, direction lock, rubber band, threshold, icon progress, `isReplyKey`.
- `features/chat/utils/gesture.ts`: swipe decision wired into the gesture state machine.
- `features/chat/hooks/use-bubble-gesture.ts`: pointer tracking, CSS variables, haptic on upward threshold crossing, reply on release.
- `features/chat/components/SwipeReplyRow/index.tsx` (new): row that moves with the swipe and shows the reply icon.
- `features/chat/components/ReplyHoverButton/index.tsx` (new): desktop hover/focus reply button.
- `features/chat/components/MessageBubble/index.tsx`, `features/chat/components/ChatThread/index.tsx`, `features/chat-groups/components/GroupThread/index.tsx`: wrap bubbles, pass `onReply`.
- `db/schema.ts`: `dm_messages.reply_to_message_id` (nullable integer, no FK).
- `features/social/services/dm-actions.ts`, `dm-mutations.ts`: `replyToMessageId` input, `resolveReplyTarget`.
- `features/social/services/dm-queries.ts`: `replyTo` quote per message, one query per page.
- `features/social/types/dm.ts`, `features/social/utils/dm-rules.ts`, `features/social/utils/dm-thread-rules.ts`: quote type, label rules.
- `features/social/components/DmBubbleList/index.tsx`, `DmThread/index.tsx`, `features/social/hooks/use-dm-thread.ts`: quote block, reply bar, swipe and hover in friend chat.
- `messages/{vi,en,zh}/chat.json`: reply strings.

## Order of work

1. Pure swipe rules and their tests (`swipe-reply.ts`, `swipe-reply.test.ts`). No UI, runs alone.
2. Gesture tracker and hook integration (`gesture.ts`, `use-bubble-gesture.ts`, `gesture.test.ts`): swipe vs long press, tap, double tap, edge, mouse, cancel.
3. `SwipeReplyRow` and `ReplyHoverButton` (presentational).
4. Wiring in `MessageBubble`, `ChatThread`, `GroupThread` (coach and group chat). Read-only threads pass no `onReply`.
5. DM schema column first (additive, nullable), then validation in `sendDmMessage`, then queries (`replyTo`), then the friend-chat UI (`ReplyBar`, quote block, scroll to and highlight).
6. i18n strings in vi, en, zh.
7. Review fixes (commit `50f446c`): tightened DM reply rules and queries, gesture cleanup, DM thread wiring.

Built as one feature commit (`3fd8df8`) and two fix commits (`a0cdbb1` scroll fix, `50f446c` review fixes).

## Risks

- Schema: additive nullable column with no foreign key, so `drizzle-kit push` on Vercel is safe. Old rows read as null.
- Scroll and back gesture: `touch-action: pan-y` on swipeable bubbles, and a 20 px edge dead zone, keep vertical scroll and the browser back gesture working. A bubble on the right edge moves toward the screen edge (known, not clipped).
- Clicks after a swipe: the click that follows a lock is swallowed for 400 ms, so a photo under the finger does not open. A wrong guess here would hide a real tap.
- Mouse: never swipes, so text selection still works.
- Friend chat sending is switched off (owner decision 2026-11-09). The DM reply path is tested but not used live until sending reopens.
- Unsent, pending and failed messages are not swipeable, and a DM reply to a missing, other-conversation or unsent target is stored as no reply rather than failing the send.

## Proof

- Unit tests: `features/chat/utils/__tests__/swipe-reply.test.ts`, `features/chat/utils/__tests__/gesture.test.ts` ("swipe to reply"), `features/social/services/__tests__/social-dm.test.ts` ("replying to a message"), `features/social/utils/__tests__/dm-thread-rules.test.ts`.
- Messages test covers vi, en, zh keys.
- Commands: `pnpm verify` before the PR (paste the tail of its output).
- Not covered by tests: touch feel, hover button, spring-back. Use `browser-proof` on a touch-emulated viewport and a desktop hover check before release.

## Deviations

None from the spec's decisions. Everything in the spec is built. The known right-edge follow-up stays open.
