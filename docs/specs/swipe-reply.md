# Swipe to reply

KAN: none (Hoan builds chat features without Jira tickets). Owner approved the decisions below on 2026-11-28.

## Goal

Swipe a chat bubble from left to right to quick-reply, the way Messenger and Zalo do. Desktop gets a hover button and the R key. The long-press actions sheet keeps its "Trả lời" item.

## Decisions

- S1. Every bubble swipes left to right, mine and theirs.
- S2. Scope: coach chat, group chat and the friend chat (DM). Admin views that render the same thread components get it too when they can write.
- S3. Desktop: a small reply button on the outer side of the bubble (right of theirs, left of mine), visible on row hover or focus inside `@media (hover:hover)`. Touch screens never show it. Key `R` (no modifier) on the focused bubble replies.
- S4. Haptic: `navigator.vibrate(10)` each time the finger crosses the threshold upward (once per crossing, so one tick in a normal swipe).
- S5. Not swipeable: unsent, sending and failed messages (`id` null or pending), and everything else where `isInteractive` is false. A thread that cannot write (locked chat, read-only DM) passes no `onReply`, so nothing is offered.
- S6. A mouse never swipes (dragging with a mouse is selecting); touch and pen do.

## Numbers (`features/chat/utils/swipe-reply.ts`)

| Constant                     | Value    | Meaning                                                             |
| ---------------------------- | -------- | ------------------------------------------------------------------- |
| `SWIPE_LOCK_PX`              | 10       | up to this much movement the direction is undecided                 |
| `SWIPE_REPLY_THRESHOLD_PX`   | 64       | released at or past this offset = reply                             |
| `SWIPE_MAX_PX`               | 96       | the row never moves further                                         |
| `SWIPE_EDGE_PX`              | 20       | a press with `clientX` below this is ignored (browser back gesture) |
| damping beyond the threshold | 0.35     | `offset = 64 + (dx - 64) * 0.35`, capped at 96                      |
| icon                         | 24 to 64 | the reply icon fades and scales in from 24 px, accent-filled at 64  |

- Direction lock: after leaving the 10 px radius the gesture is a swipe only if `dx > 0` and `|dx| > |dy|`. Anything else (a scroll, a leftward drag) gives up, with the previous behaviour: long press and tap are dropped.
- On lock: the long press and any pending tap or double-tap are cancelled, the pointer is captured, and a click that follows within 400 ms is swallowed (so a photo tile under the finger does not open).
- Release past the threshold calls `onReply`; otherwise the row springs back (200 ms ease-out, no transition under `prefers-reduced-motion`). The offset is written straight to CSS variables (`--swipe-x`, `--swipe-p`) on the row, with no React re-render while the finger moves.
- Bubbles that can reply use `touch-action: pan-y`, so horizontal moves reach pointer events while vertical scrolling still works.

## Friend chat (additive schema)

- `dm_messages.reply_to_message_id`, nullable integer, no foreign key (like the other DM tables).
- `sendDmAction` accepts `replyToMessageId` (`z.number().int().positive().optional()`).
- `sendDmMessage` keeps it only when the target exists in the same conversation and is not unsent; otherwise it stores null and the send still succeeds. A message that replies to a post (`reply_post_id`) never also carries a message reply: the post reply wins.
- `listDmThread` and `getDmMessageView` return `replyTo: { id, senderId, body, photoCount, deleted } | null` per message, with the quoted rows loaded in one query per page (no N+1). `body` is trimmed to 120 characters and null for an unsent or photo-only original; the client builds the label ("Ảnh", "3 ảnh", "Tin nhắn đã bị thu hồi"). An unsent original stays as a tombstone.
- UI: a reply bar above the composer (`ReplyBar`, "Đang trả lời {name}"), a quote block on top of the bubble that scrolls to and highlights the original when it is loaded, and the same swipe, hover button and R key through `useBubbleGesture`.
- Sending in friend chats is currently switched off (owner decision 2026-11-09), so the DM chat is read-only and the reply controls stay hidden there. The path is built and tested for the day it opens again.

## Test matrix

| Rule                                                       | Test                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| S: constants, direction lock, rubber band, threshold, icon | `features/chat/utils/__tests__/swipe-reply.test.ts`                              |
| S: R key without modifiers                                 | `swipe-reply.test.ts` (`isReplyKey`)                                             |
| Swipe vs long press, tap, double tap, edge, mouse, cancel  | `features/chat/utils/__tests__/gesture.test.ts` ("swipe to reply")               |
| DM reply: valid target, quote, trimming, photo-only label  | `features/social/services/__tests__/social-dm.test.ts` ("replying to a message") |
| DM reply: other conversation, unsent, missing, none        | same                                                                             |
| DM reply: post reply wins                                  | same                                                                             |
| DM reply: unsent original is a tombstone                   | same                                                                             |
| DM action input (bad id refused, stale id dropped)         | same                                                                             |
| UI strings in vi, en and zh                                | messages test                                                                    |

Not covered by tests: the touch feel, the hover button and the spring-back in a real browser. Use `browser-proof` on a touch-emulated viewport before release.

## Open questions

None blocking. Known follow-up: a bubble on the right edge moves toward the screen edge while swiping, and is not clipped.
