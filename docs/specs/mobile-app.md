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

## Admin side (PT and super admin)

Signed in as an admin the tab bar is Overview (`/dashboard`), Trainees (`/members`), Feed, Messages, Me; the Workouts tab is hidden (`href: null`) and the admin tabs are hidden for trainees. Stack screens live in `app/admin/*` (guarded: a trainee is redirected). Code: `src/features/admin`, strings `src/i18n/locales/{vi,en,zh}/admin.json` (namespace `admin.*`, merged in `src/i18n/index.ts`), pure helpers `src/lib/admin-utils.ts`.

| Screen | Route | Endpoints |
| --- | --- | --- |
| Dashboard | tab `dashboard` | `GET /v1/dashboard/summary` (`week`, `pt`), `GET /v1/dashboard/activity` |
| Trainees | tab `members`, `admin/trainee/new` | `GET/POST /v1/trainees`, passcode typed in the search box calls `POST /v1/admins/me/hidden-users/reveal` |
| Trainee detail | `admin/trainee/[userId]` | `GET/DELETE /v1/trainees/:id`, `PATCH :id/email`, `POST :id/password-reset` (shown once), `PUT :id/pt` (super admin), `PUT /v1/chat/trainees/:id/enabled`, `POST /v1/admins/me/hidden-users`, chat opens `chat/trainee/[userId]` |
| Progress and activity | `.../progress` | `GET /v1/trainees/:id/progress`, `/activity` |
| Restriction (super admin) | `.../restriction` | `GET/PUT/DELETE /v1/trainees/:id/restriction` |
| Workout plan | `.../workouts` | `GET /v1/trainees/:id/workout-days` (+ `copy-info`), `PUT workout-days/:date`, `POST workout-days/:date/exercises`, `PUT/DELETE exercises/:eid`, `POST exercises/:eid/move`, `POST workout-days/copy-week`, `copy-day` |
| Nutrition | `.../nutrition` | `GET /v1/trainees/:id/nutrition`, `PUT nutrition-target`, `PUT body-profile` |
| Meal plan | `.../meal-plan` | `GET meal-plan-days` (+ `copy-info`), `POST meal-plan-days`, `copy`, `apply-last-week`, `DELETE /v1/meal-plan-days/:id`, meals (`POST/DELETE/PATCH`, `PUT order`, `PUT shares`), items (`POST/PATCH/DELETE`), `POST meals/:id/auto-solve` |
| Food library (super admin) | `admin/foods`, `admin/foods/[id]` | `GET/POST/PATCH/DELETE /v1/foods`, `GET /v1/foods/groups`; any admin can search foods in the meal picker |
| PTs (super admin) | `admin/pts` | `GET/POST /v1/pts`, `PUT /v1/admins/:id/verified` |
| Admin me | Me tab section | `GET /v1/admins/me`, `PUT/DELETE avatar` (256 px JPEG data URL under 80 KB), `PUT chat-color`, `PUT presence-hidden` |
| Passcode | `admin/me/passcode` | `PUT /v1/admins/me/passcode`, `POST passcode/change`, `DELETE passcode`, `POST passcode/lock` |
| Lock screen | replaces the app in `app/_layout.tsx` while `actor.locked` | `POST /v1/admins/me/passcode/verify`, `POST passcode/reset` (password + new code), then `GET /v1/auth/me`; a timer re-reads the session when the unlock ends |
| Hidden trainees | `admin/me/hidden` | `GET/DELETE /v1/admins/me/hidden-users`, `POST hidden-users/reveal` |
| Trainee chats (super admin) | `admin/dm`, `admin/dm/[cid]` | `GET /v1/admin/dm/conversations`, `GET /v1/dm/conversations/:cid/messages` (read-only) |

Decisions: roles follow the API (it scopes a PT to their own trainees); the UI hides what a role cannot use (PT picker, restrictions, foods, PTs, trainee chats are super admin only, as on the web). Forms are bottom sheets with API field errors under the field. The one-time password is shared with the system share sheet (no clipboard package in the app). Not in the app: social reports page, group management, other trainees as copy-week targets beyond the trainee list endpoint.
