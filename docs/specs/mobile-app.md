# Mobile app (apps/mobile)

Status: implemented on `feat/mobile-app`. No Jira key yet (add the KAN key when the ticket exists).

## Scope

In: authentication, social feed, messenger, push notifications, Me tab, vi/en/zh.
Out: workouts, nutrition and admin tooling (a placeholder Workouts tab only), Google sign-in (cancelled), sticker packs (shown as their alt text), group management, creating DMs (read-only by API rules).

## Screens and navigation

Expo Router with `Stack.Protected` guards: signed-out users only reach `login`; signed-in users reach the rest.

- Tabs: Feed (`/`), Messages (`/messages`, unread badge = coach + DM + groups), Workouts (placeholder), Me.
- Stack: `login`, `compose`, `post/[id]`, `profile/[key]`, `notifications`, `sessions`, `chat/coach`, `chat/trainee/[userId]` (admin), `chat/group/[id]`, `chat/dm/[cid]`.

## API mapping

| Area | Endpoints |
| --- | --- |
| Auth | `POST /v1/auth/login`, `POST /v1/auth/admin/login`, `GET /v1/auth/me`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `GET/DELETE /v1/auth/sessions`, `PUT /v1/me/locale` |
| Feed | feed list, `POST /v1/social/photos` (raw JPEG), `POST /v1/social/posts` with `Idempotency-Key`, post edit/delete, reactions and reactors, comments, `GET /v1/social/profiles/:key` and `/posts`, notifications and mark read |
| Messenger | `/v1/chat/inbox`, `/bubbles`, `/unread`, `/groups`, `/groups/unread`, `/conversations/me`, `/conversations/:cid`, `/trainees/:userId/conversation`, messages (send, edit, unsend, reaction, read, photos), `/v1/dm/conversations` and `/:cid/messages` and `/read`, stickers (GIPHY proxy, own stickers) |
| Realtime | Socket.IO namespace `/chat`, `auth: { token }`, event names from `@pt/contracts` `REALTIME_EVENTS` |
| Push | `POST /v1/push/devices {token, platform}`, `DELETE /v1/push/devices {token}` |

## Decisions

- Framework-free API client with injected fetch, timeouts, Zod validation of responses and an `ApiError` mapping; a 401 ends the session.
- Session refresh follows the API rules: admin when under 5 days remain, trainee when under 30.
- One `ChatMsg` model with adapters for coach, group and DM messages, so one `ConversationView` serves all chats.
- Realtime events only trigger a thread sync (fetch what is new or changed since the cursor); the socket closes in the background and reconnects with a gap fill on foreground; polling every 5 s while the socket is down.
- Reactions are optimistic with rollback; any single emoji is accepted, validated by code-point ranges (Hermes has no `Intl.Segmenter`).
- Photos are picked, resized (max 1600 px), JPEG-compressed (target 400 KB, hard cap 1.5 MB) and uploaded as raw bytes as soon as picked, with retry.
- Admin locked by passcode: chat is disabled (no socket, no chat queries) and a lock notice shows.
- Push payload `{title, body, url, tag}`; web paths are mapped to app routes, unknown ones open Messages. Registration is skipped without an EAS project id.
- Images use `expo-image` with a Bearer header through one `AuthImage`.

## Test matrix

| Unit | Covered by |
| --- | --- |
| API client (URL building, errors, 401, upload, timeout) | `src/lib/__tests__/api-client.test.ts` |
| Session refresh thresholds, single flight | `session-refresh.test.ts` |
| Emoji validation | `emoji.test.ts` |
| Photo resize/quality planning | `image-plan.test.ts` |
| Chat model: adapters, merge, grouping, reads, optimistic | `chat-model.test.ts`, `message-reactions.test.ts` |
| Post reaction transitions | `reactions.test.ts` |
| Realtime event mapping, typing | `realtime-events.test.ts` |
| Push URL to route mapping | `push-routes.test.ts` |
| Time formatting | `time.test.ts` |
| i18n key and placeholder parity | `src/i18n/__tests__/messages.test.ts` |

Not covered by automated tests: screens and navigation (no device in CI), push delivery, the realtime socket against a live API. Manual checks: sign in as trainee and admin, post with photos, react, open a chat on two devices, background and foreground the app, tap a push.

## Open points

- Add the KAN ticket key and EAS project id.
- Sticker packs from the web are shown as text.
- Smoke test against the Docker stack was not run in the authoring environment (no Docker daemon).
