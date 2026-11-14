# Super admin blocks a trainee

Owner-approved feature, no Jira key (Hoan chose to skip Jira). Delivered in two PRs: this one (PR 1) and a later one that adds reporting chat messages and a "Hide + block" button reusing the block sheet (PR 2, not part of this spec).

## Goal

A super admin can restrict or suspend a trainee for a limited time or permanently, with a reason the trainee sees. A PT cannot. No data is deleted.

## Decisions

### Who

- D1 Only super admins (`admins.role` null or `super_admin`, `requireSuperAdmin()`). Only trainees (`users`) can be blocked, never admins.
- D2 PTs see no block control on the trainee page. The users list badge is read-only and visible to every admin who can see the trainee.

### Levels

- D3 `restricted`: the trainee still signs in and uses workouts and meals. The server refuses their chat, social and friend writes (list in "Guarded actions"). A banner on every trainee page shows the level, when it ends (or "permanent") and the reason.
- D4 `suspended`: the trainee cannot sign in. Login is refused with a message showing the end time (or permanent) and the reason, but only after the password was correct (a wrong password never reveals a suspension). Open sessions are rejected in `getCurrentUser()` (`services/auth-guard.ts`), so `requireUser()` ends the session like a deleted user or a password change. Suspended trainees are hidden from everyone else: feed, friend lists, pending requests, email search, profiles, direct messages and comments. They are treated as blocked either way in `isBlockedBetween` / `listBlockedBetweenIds` (`features/social/services/relationships.ts`).
- D5 Duration: 24 hours, 7 days, 30 days or permanent.

### Time and state

- D6 No cron. A restriction is active when `lifted_at` is null and (`until` is null or `until > now`), computed on every read (`isRestrictionActive`, and the same rule as SQL in `activeRestrictionWhere`).
- D7 The super admin can lift early ("Gỡ chặn"). Lifting records `lifted_at` and `lifted_by_admin_id`.
- D8 One active restriction per trainee. Blocking again lifts the previous active one first (in one transaction); older rows stay as history.
- D9 The reason is required, trimmed, at most 300 characters.

### Kept as is

- D10 The per-trainee chat switch (`users.chatEnabled`) and trainee-to-trainee `social_blocks` are untouched. A restriction is an extra layer on top of both.
- D11 Reading stays allowed for a restricted trainee, and so does taking their own content back: unsend a chat message, delete their own post or comment, decline or cancel a friend request, block or unblock another trainee, report.

### Guarded actions (restricted trainee is refused)

- Chat: `sendMessageAction` (text, sticker, photo), `reactMessageAction`, `editMessageAction`; photo upload `POST /api/chat/photos`.
- Social: `createPostAction`, `editPostAction`, `updateBioAction`, `reactAction`, `addCommentAction`, `editCommentAction`; photo upload `POST /api/social/photos`.
- Friends: `sendFriendRequestAction`, `acceptFriendRequestAction`.
- Direct messages: `sendDmAction`; photo upload `POST /api/dm/photos`.

One helper answers all of them: `restrictionErrorFor(userId)` in `features/restrictions/services/restriction-guard.ts` (social actions go through `restrictedWriteError(actor)` in `actor-guard.ts`).

### Data (additive only)

New table `user_restrictions`, no foreign keys like the nearby tables: `id`, `user_id`, `level` (`restricted` | `suspended`), `until` (ms, null = permanent), `reason` (default ""), `created_by_admin_id`, `created_at`, `lifted_at`, `lifted_by_admin_id`; index on (`user_id`, `created_at`). The member delete removes the trainee's rows (`deleteRestrictionsOfUser`, inside the delete transaction).

### UI

- Trainee detail page (super admin only): "Chặn" button opens `BlockUserSheet` (level, duration, reason). While a block is active the page shows its status and "Gỡ chặn" plus "Đổi mức chặn" (opens the same sheet; saving replaces the block).
- `BlockUserSheet` takes a `userId` and is reusable, so PR 2 can open it from a chat report.
- Admin users list: badge "Bị hạn chế" / "Bị khoá".
- Trainee banner in `app/(user)/(protected)/layout.tsx`; login error from `loginWithEmailAction`.
- Copy: Vietnamese default, English and Chinese in `messages/{vi,en,zh}/restrictions.json` (UI) and `errors.json` (server messages).

## Open questions

- None blocking. Noted for the owner: custom sticker upload (`POST /api/chat/stickers/custom`), typing indicator and chat nickname/colour settings are not guarded (they send nothing to anyone); photo uploads are guarded as well as the send, so a restricted trainee cannot park files.

## Test matrix

| Case                                                                                                                                       | Where                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| active / expired / lifted / permanent, end from duration                                                                                   | `utils/__tests__/restriction-rules.test.ts`                                                 |
| reason required and at most 300, bad level / duration / id                                                                                 | `utils/__tests__/restriction-rules.test.ts`                                                 |
| block stores level, end, reason, admin; permanent has no end                                                                               | `services/__tests__/restriction-service.test.ts`                                            |
| re-block lifts the previous one and keeps history                                                                                          | `services/__tests__/restriction-service.test.ts`                                            |
| lift early, lift when nothing active, bad id                                                                                               | `services/__tests__/restriction-service.test.ts`                                            |
| nonexistent user and bad values refused, nothing written                                                                                   | `services/__tests__/restriction-service.test.ts`                                            |
| PT cannot block or lift (redirected, nothing written)                                                                                      | `services/__tests__/restriction-service.test.ts`                                            |
| expiry computed at read time, lists, suspended ids                                                                                         | `services/__tests__/restriction-service.test.ts`                                            |
| member delete removes the trainee's rows only                                                                                              | `restriction-service.test.ts`, `features/members/services/__tests__/member-actions.test.ts` |
| restricted: chat send (text, sticker, photo), react, edit refused; unsend and read allowed                                                 | `services/__tests__/restriction-guards.test.ts`                                             |
| restricted: post, edit post, bio, comment, edit comment, post reaction, friend request, accept, DM refused; delete own and decline allowed | `services/__tests__/restriction-guards.test.ts`                                             |
| lifted or expired block lets the trainee write again                                                                                       | `services/__tests__/restriction-guards.test.ts`                                             |
| suspended: session rejected, restricted session kept, lifted / expired back in                                                             | `services/__tests__/restriction-session.test.ts`                                            |
| suspended: login refused with end and reason (vi, en), permanent, wrong password hides it, restricted can log in                           | `services/__tests__/restriction-session.test.ts`                                            |
| suspended hidden from friends, feed, search, requests, blocked-either-way; restricted not hidden; nothing deleted                          | `services/__tests__/restriction-hidden.test.ts`                                             |
| messages exist in vi, en, zh                                                                                                               | `i18n/__tests__/messages.test.ts`, `i18n/__tests__/localize-message.test.ts`                |

No e2e tests (skipped by the owner).
