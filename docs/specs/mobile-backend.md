# Mobile backend (Expo app: posts feed and messenger)

Branch `feat/mobile-backend`. Makes the API ready for the Expo app and closes
gaps with the production web app (PRs #213, #215, #217). Approved by Hoan; no
open questions.

## Scope

In: Expo push, any-emoji reactions, unsend that keeps content plus a super admin
reveal, the `appBadge` number, a check that native clients can load media.

Out (not built): Google OAuth (dropped by Hoan, authentication is unchanged),
theme / accent-color endpoints, workouts, nutrition, any web UI beyond compile
fixes.

## Decisions

1. **Expo push.** Phones are `push_subscriptions` rows with `kind = 'expo'`; the
   token is the unique `endpoint`, `p256dh` / `auth` are NULL, `user_agent` is
   `expo:<platform>`. The same token registered by another account moves to that
   account (same upsert as web). No schema change.
2. **Sender.** `ExpoPushSender` POSTs to `https://exp.host/--/api/v2/push/send`
   with `fetch`, 100 messages per request. `PushSender` gets an optional
   `sendMany`; `PushService` uses it for a kind that has it and retries only the
   temporary failures (429, 5xx, network, `MessageRateExceeded`, 3 attempts).
   `DeviceNotRegistered` deletes the subscription. Always enabled (no key
   needed); `EXPO_ACCESS_TOKEN` is optional and sent as a Bearer token when
   set. Each request times out after 10 seconds (a retryable failure).
   Expo push receipts are not polled yet: a dead token is removed only when the
   send ticket says `DeviceNotRegistered`, so a token Expo reports later through
   a receipt stays until its next send fails that way.
3. **Push data.** Each message carries `data: { url, tag, kind, ids }`, derived
   from the push tag: `chat_message` / `chat_reaction` (`conversationId`),
   `group_message` (`groupId`), `social` (`postId` when the tag has one),
   `report`, else `other`.
4. **Badge.** `AppBadgeService` (in `ChatModule`) sums unread coach chat, trainee
   DMs (trainees only), group messages and unread social notifications for one
   actor, with the same queries as each module's own badge poll. `GET
   /v1/chat/unread` adds `appBadge`; `PushService` adds `badge` to the payload of
   Expo devices only (web payloads are unchanged). A failed count never blocks a
   push. `GET /v1/chat/unread` reuses the coach, DM and admin chat numbers it
   already computes and queries only groups and notifications on top.
5. **Reactions.** Chat, group chat and social share one rule
   (`isReactionEmoji`, `packages/contracts/src/reaction-emoji.ts`): exactly one
   grapheme cluster (`Intl.Segmenter`), at most 64 UTF-8 bytes, whose whole
   cluster is an emoji shape: an Extended_Pictographic sequence (optional VS16
   or skin tone, ZWJ joins, tag sequences), two regional indicators or a keycap
   (`[0-9#*]` + optional VS16 + U+20E3). Plain letters, digits, punctuation,
   stacked combining marks and a lone keycap mark fail. `DEFAULT_REACTION_EMOJIS` is the picker's first
   row. `CHAT_REACTION_EMOJIS` / `SOCIAL_REACTION_EMOJIS` are removed from the
   contracts (the web keeps its own list). The 💪 stored earlier stays valid. No
   database constraint existed, none was added.
6. **Unsend.** Chat and DM now only set `deleted_at` (as group chat already
   did). Text, sticker, quote (`reply_post_id`) and photos stay stored; the
   mappers and queries already blank deleted rows, so every normal read is
   unchanged. Photo GET routes (`/chat/photos/:id`, `/dm/photos/:id`,
   `/chat/groups/:gid/photos/:id`) refuse the photo of an unsent message for
   everyone except a super admin.
7. **Original.** Three GET routes, super admin only (`403` for others,
   `404` when the message is live or missing). The message view is built with
   the content restored, then marked `deleted: true`; `unsentAt` is the real
   `deleted_at`. `Cache-Control: no-store`.
8. **Media on native clients.** Auth reads `Authorization: Bearer` only (no
   cookies, no query token), the API has no CORS or Origin check, and avatar
   URLs are signed capability URLs. Nothing to change; a test pins it.

## Endpoints

All under `/v1`, `Authorization: Bearer <token>`.

| Method and path | Who | Request | Response |
| --- | --- | --- | --- |
| `POST /push/devices` | any signed-in | `{ token: "ExponentPushToken[..]" or "ExpoPushToken[..]", platform: "ios" or "android" }` | `204`; `400` on a bad token or platform |
| `DELETE /push/devices` | any signed-in | `{ token }` | `204` (only the caller's own device is removed) |
| `GET /chat/unread` | trainee | - | `{ count, coachCount, dmCount, chatEnabled, hasHistory, latestLoudIncomingId, appBadge }` |
| `GET /chat/unread` | admin | - | `{ count, perTrainee[], appBadge }` |
| `PUT /chat/messages/:mid/reaction`, `PUT /chat/groups/:gid/messages/:mid/reaction`, `PUT /social/posts/:id/reaction` | as before | `{ emoji }` any single emoji | as before; `400` when not one emoji |
| `GET /chat/messages/:mid/original` | super admin | - | `{ message: ChatMessageView (deleted: true, original content), unsentAt }` |
| `GET /dm/messages/:mid/original` | super admin | - | `{ message: DmMessageView, unsentAt }` |
| `GET /chat/groups/:groupId/messages/:mid/original` | super admin | - | `{ message: GroupMessageView (deleted: true, original content), unsentAt }` |

`GET /push/subscriptions` lists Expo devices with `kind: "expo"`.

Push message to Expo: `{ to, title, body, data: { url, tag, kind, ids }, sound:
"default", priority: "high", ttl: 3600, channelId: "default", badge? }`.

### How mobile loads images

Every image URL in a payload is a path on the API host (`/v1/avatars/user/3?v=..&t=..`,
`/v1/chat/photos/12`, `/v1/dm/photos/9`, `/v1/chat/groups/4/photos/7`, social
photo URLs). Prefix the API base URL and send the same `Authorization: Bearer`
header the JSON calls use (expo-image: `source={{ uri, headers: { Authorization } }}`).
Keep the avatar query string as given: `v` makes the response cacheable for a
year and `t` is the signature that lets a signed-in user see someone else's
avatar. Do not put the token in the URL or rely on cookies; both give `401`.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXPO_ACCESS_TOKEN` | unset | Expo push security token; only needed if the Expo project enforces it. In `docker-compose.yml` as an empty value. |

## Test matrix

| Area | Where | Covers |
| --- | --- | --- |
| Expo token / platform schemas | `packages/contracts/src/__tests__/push-realtime-schemas.test.ts` | both token forms, URLs, empty, bad platform |
| Expo sender | `apps/api/src/push/senders/expo-push.sender.test.ts` (mocked fetch) | badge present / absent, auth header, batches of 100, `DeviceNotRegistered` gone, 429 / 5xx / network retry, 4xx failed, data from tags |
| Push service | `apps/api/src/push/push.service.test.ts` | `sendMany` path with partial retry, badge only on Expo, counting failure still sends |
| Reaction emoji | `packages/contracts/src/__tests__/reaction-emoji.test.ts`, `social-api-schemas.test.ts` | defaults, 💪, flags, skin tones, ZWJ, keycaps, letters, digits, two clusters, over 64 bytes, all three request schemas |
| Reactions e2e | `chat.e2e`, `chat-groups.e2e`, `social-engagement.e2e` | any emoji accepted, text and two emoji refused |
| Unsend keeps content | `chat-media.e2e`, `dm.e2e`, `chat.e2e`, `chat-groups.e2e` | rows and photos stay, readers get blanks, photo 404 for owner / member / PT, 200 for super admin |
| Original | `chat-media.e2e`, `dm.e2e`, `chat-groups.e2e` | live message 404, trainee / PT / member 403, 401 unauthenticated, super admin gets text, photos and `unsentAt` |
| App badge | `apps/api/src/chat/app-badge.service.test.ts`, `chat.e2e` | sum of the four parts, admin without DMs, owner key parsing, read notifications not counted |
| Native media | `avatars.e2e` | Bearer only works, cookie only and query token give 401, bare id still 404 |

## Notes

- `GET /chat/unread` still counts an unsent message as unread (existing rule of
  the chat query); `appBadge` follows it so the two numbers agree.
- The compose `api` image could not be built in the sandbox (npm behind a
  TLS-intercepting proxy), so the endpoints were smoke-tested against the
  compose PostgreSQL with the API run from `dist/`.
