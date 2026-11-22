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

## Trainee: workouts, nutrition, profile, splash

Navigation decision: Nutrition is its own tab ("Dinh dưỡng", trainees only; hidden for admins with `href: null`), between Workouts and Me. The web's week summary page lives at `/summary` (header icon of Workouts, link in Me). Screens pushed over the tabs sit in the route group `app/(trainee)` (`summary`, `foods`, `password`).

Screens (all trainee, `requireUser` side of the API):

| Screen | Route | Endpoints |
| --- | --- | --- |
| Workouts week + day (YouTube thumbnail opens YouTube, set logger with last-session hints, completion toggle, timed exercises read-only, personal best badge) | `(tabs)/workouts` | `GET /v1/me/workout-days?from&to`, `PUT /v1/me/exercises/:id/sets`, `PUT /v1/me/exercises/:id/completion` |
| Nutrition week: daily target bars, PT meal plan with logs and "Đạt" mark, request to PT, older free-text log (edit, delete, add on days without a plan) | `(tabs)/nutrition` | `GET /v1/me/nutrition`, `GET /v1/me/meal-plan-days`, `POST /v1/me/meals/:id/logs`, `PATCH/DELETE /v1/me/meal-logs/:id`, `PUT /v1/me/meals/:id/mark`, `PUT /v1/me/meal-preferences`, `POST/PUT/DELETE /v1/me/food-entries` |
| Food library (search, group chips, localized names, per 100 g) and the food picker of the log sheet | `/foods` | `GET /v1/foods`, `GET /v1/foods/groups` |
| Week summary: workout progress, nutrition numbers, weight chart + weigh-in, body profile form | `/summary` | `GET /v1/me/nutrition`, `GET /v1/me/workout-days`, `PUT /v1/me/weight-logs/:date`, `PUT /v1/me/body-profile` |
| Me (trainee): photo, bio, chat colour, week summary link, password | `(tabs)/me`, `/password` | `GET /v1/users/me`, `PUT/DELETE /v1/users/me/avatar`, `PUT /v1/users/me/chat-color`, `PUT /v1/me/bio`, `POST /v1/users/me/password` |

Rules ported to `src/lib` (unit-tested): `workouts-model` (timed reps, set rows, parsing with the contract schema, progress), `nutrition-model` (macro maths 4/4/9, counted meal numbers incl. frozen marks, on-target rule, meal split of the day target), `week` (Monday weeks, Vietnam time), `avatar-plan`, `password-rules`.

Notes and gaps:

- The avatar endpoint takes a JSON `{ dataUrl }` (256 px, at most 80 KB), not raw bytes: the app crops to a square, resizes and lowers the JPEG quality until it fits.
- The "personal accent colour" has no API yet; the Me tab says so and nothing is stored.
- The video opens in YouTube (no in-app player: no WebView dependency was added).
- Splash: native splash (light `#f4f4f5`, dark `#0c0c0e`, dumbbell mark) stays up until the icon font and the session bootstrap are done, then fades out (`SplashScreen.setOptions({ fade: true })`). Icons and splash images are generated by `apps/mobile/scripts/generate-brand-assets.mjs` from the web PWA dumbbell.
- Strings live in `src/i18n/locales/{vi,en,zh}/{workouts,nutrition,account}.json`, merged over the base files by `src/i18n/index.ts`.
