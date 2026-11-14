# Plan: group chat

Commit the approved plan-mode output as `docs/specs/group-chat.plan.md`, next to the spec, before implementation starts.

## Source

- Intent: `intent/2026-11-14-group-chat.md`
- Spec: `docs/specs/group-chat.md`
- Jira: none (owner decision 2026-11-14)

Three build PRs into `main`, in order. Branches: `feat/group-chat-core`, `feat/group-chat-admin-ui`, `feat/group-chat-trainee-ui`. **The core PR waits until the block-user and report PRs have merged** (it uses their restriction check and the `social_reports` enum); the spec and this plan can merge before. Each PR keeps `pnpm verify` green. E2E is skipped.

New code lives in a new feature folder `features/chat-groups/{components,hooks,services,utils,constants,types}`; shared chat pieces stay in `features/chat` and are imported through `@/`.

## Shared seams studied (why the plan looks like this)

- The coach chat UI is shared by trainee and admin through `ChatAdapter` (`features/chat/hooks/use-chat-messages.ts`) built in `use-chat-adapter.ts`, plus `ThreadViewer` in `chat-thread-rules.ts` and `useChatTransport` (Ably or polling). The old trainee DM (`features/social` `DmThread`, `use-dm-thread.ts`) is a separate stack with its own tables and channel `chat:dm:conversation:<id>`; it is the model for "a second chat kind" at the data and Ably level, while groups reuse the coach chat's UI through the adapter, as decided.
- `ThreadMessage` / `SerializedChatMessage` know only `senderRole: "user" | "admin"`. Groups add optional fields (`senderKey`, `senderName`, `senderTag`, `kind`, `systemEvent`, `seenCount`, `hidden`) and a third viewer variant; all optional so the coach chat code and tests are unaffected.
- Push: `deliver`, `loadOwnerLocales`, `deliverLocalized` in `chat-push.ts` take targets from `push_subscriptions.owner_key` (`user:<id>` / `admin:<id>`), which is exactly the `member_key` format.
- Ably: names must start with `chat:` (`ably-capabilities.ts`); capabilities are subscribe-only and, for groups, one channel each.

## Files that change

### PR 1: `feat/group-chat-core` (DB, services, actions, API, unit tests; no UI)

Schema and pure rules

- `db/schema.ts`: add `chatGroups`, `chatGroupMembers`, `chatGroupMessages`, `chatGroupReactions`, `chatGroupMessageEdits`, `chatGroupPhotos` (all new, additive; shapes in the spec); add `"group_message"` to the `socialReports.targetKind` enum (TypeScript only).
- `features/chat-groups/constants/messages.ts`: Vietnamese error and block-reason strings (`GROUP_MESSAGES`), key names for i18n.
- `features/chat-groups/constants/limits.ts`: `GROUP_MEMBER_CAP = 50`, name length 1..60, page sizes (reuse `CHAT_PAGE_SIZE`).
- `features/chat-groups/types/group.ts`: `GroupActor`, `GroupSummary`, `GroupMessageView`, `SystemEvent` (discriminated union), `GroupRole`.
- `features/chat-groups/utils/group-rules.ts`: Zod schemas (create, rename, add/remove, send, react, edit, hide, resolve alert), `buildGroupActor`, `canManageGroup`, `isManagerActor`, `groupSendBlockReason(...)` (pure; takes `restricted` as an input), member-cap math.
- `features/chat-groups/utils/system-event.ts`: parse and validate `system_event` JSON, safe fallback for bad rows, `toSystemLine(event, names, t)` helper input shape.
- `features/chat-groups/utils/group-unread.ts`: unread and seen-by calculations that are testable without a DB.
- `features/chat/utils/ably-capabilities.ts`: add `groupChannel(id)` = `chat:group:<id>`, `groupCapability(groupId)` (one channel, subscribe only, `assertId`), `GROUP_EVENTS` (`message`, `message-update`, `read`, `members`) and ids-only event builders. No wildcard helper for groups.

Services (server-only, Drizzle)

- `features/chat-groups/services/group-access.ts`: `loadGroupActor(groupId, session)` for admins and trainees; the only door for reads, mutations, API routes and the token; `notFound` for missing, dissolved (non super admin), non-member, left. Hook point: `loadTraineeRestriction(userId)` calls the block feature's check (name and source taken from the merged block PR) and is the single place that knows about it.
- `features/chat-groups/services/group-queries.ts`: list groups for an actor with last message, unread, muted flag, avatar version; thread page (`before`, `after`, `changedSince`) with the `audience` filter (rows with `audience = 'super_admin'` only for super admins); members list; seen-by list; `countGroupUnread(actorKey)` with the super-admin baseline (`admins.created_at`).
- `features/chat-groups/services/group-actions.ts`: server actions for both roles through one core (`'use server'` wrappers per role: `requireAdmin()` / `requireUser()` first): create group, add members, remove member, leave, rename, set avatar, set managers-only, mute, send, react, edit, unsend, hide / unhide, mark read, report, upload photo helper. Add-members transaction enforces scope (G1), the cap (G9), skips bad ids per id.
- `features/chat-groups/services/group-admin-actions.ts`: `dissolveGroupAction` and `resolvePtChangeAlertAction` (`requireSuperAdmin()`, guarded single update, "already handled by <name>").
- `features/chat-groups/services/group-mutations.ts`: shared message mutations (react, edit with history, unsend, hide) mirroring `chat-mutations.ts` rules for the group tables, so both roles use one implementation.
- `features/chat-groups/services/group-system-lines.ts`: `appendSystemLine(groupId, event, audience?)` (updates `last_message_*`), and `recordPtChangeInGroups(userId, fromPtId, toPtId)` (finds active groups, supersedes older unresolved alerts, inserts one alert per group).
- `features/chat-groups/services/group-photos.ts`: photo upload and serving checks, mirrors `chat-photos.ts` and `dm-photos.ts`; avatar read/write with the helpers of `features/avatar/services/avatar.ts`.
- `features/chat-groups/services/group-realtime.ts`: `publishGroupMessage`, `publishGroupUpdate`, `publishGroupRead`, `publishGroupMembers`, `createGroupTokenRequest(groupId)` on top of `chat-realtime.ts` (`publishChatEvent`, token creation); no-ops without Ably configured.
- `features/chat-groups/services/group-push.ts`: `sendGroupPush` / `scheduleGroupPush`: targets = active explicit members + implicit super admins, minus sender and `muted_at`; two `deliverLocalized` calls (trainee deep link `/messages/groups/<id>`, admin deep link `/admin/messages/groups/<id>`); skip silent; body never logged.
- `features/chat-groups/services/group-cleanup.ts`: `removeUserFromGroups(userId)` and `removeAdminFromGroups(adminId)` used by member and PT deletion.
- `features/pts/services/pt-actions.ts`: `assignTraineePtAction` reads the old `ptAdminId`, returns success without writing when unchanged, updates, then `recordPtChangeInGroups` (errors caught and logged, never undo the assignment). Grep for any other writer of `users.ptAdminId` at build time and hook it too.
- `features/members/services/member-actions.ts` and the PT delete action in `features/pts/services/pt-actions.ts`: call the cleanup functions.
- `features/social` report service: accept `group_message` targets (membership-checked) once the report PR is merged.

API routes (all through `loadGroupActor`, 404 on failure)

- `app/api/chat/groups/route.ts` (GET list), `app/api/chat/groups/[groupId]/messages/route.ts` (GET page, changedSince), `.../messages/[messageId]/edits/route.ts`, `.../messages/[messageId]/seen/route.ts`, `.../members/route.ts`, `.../photos/route.ts` (POST upload) and `.../photos/[photoId]/route.ts` (GET), `.../avatar/route.ts` (GET).
- `app/api/chat/ably-token/route.ts`: accept `?group=<id>`; membership check; `groupCapability` only.
- `app/api/chat/unread/route.ts` and `features/chat/utils/unread-payload.ts`: add `groups: { total, perGroup }`; no change for existing fields.

Tests (Vitest, next to the code)

- `features/chat-groups/utils/__tests__/group-rules.test.ts`, `system-event.test.ts`, `group-unread.test.ts`; `features/chat/utils/__tests__/ably-capabilities.test.ts` (group cases); `features/chat-groups/services/__tests__/group-access.test.ts`, `group-actions.test.ts`, `group-mutations.test.ts`, `group-queries.test.ts`, `group-system-lines.test.ts` (PT-change alert and resolve), `group-push.test.ts`, `group-cleanup.test.ts`; `features/pts/services/__tests__/pt-actions.test.ts` (changed vs unchanged assignment); route tests following the existing route-test style. Cases per the spec test matrix.

### PR 2: `feat/group-chat-admin-ui` (admin and super admin screens)

- `messages/{vi,en,zh}/chatGroups.json` (new namespace: list, thread, system lines, info page, create flow, alert, banners, errors) and its registration where namespaces are loaded.
- `features/chat/utils/chat-thread-rules.ts`: widen `ThreadViewer` with a `member` variant, add optional group fields to `SerializedChatMessage`, and `isOwnMessage(message, viewer)`; first add characterization tests for the current sender logic, then change the call sites that test `viewer.role === "admin"`. `features/chat/hooks/use-chat-messages.ts`: let `ChatAdapter.sendMessage` return a result type both flavours satisfy.
- `features/chat-groups/hooks/use-group-chat-adapter.ts`: builds a `ChatAdapter` for a group (messages and edits URLs, group actions, photo upload to `/api/chat/groups/<id>/photos`), the same pattern as `use-chat-adapter.ts`.
- `features/chat/hooks/use-chat-transport.ts`: accept an optional `groupId` (token URL `?group=<id>`, channel `groupChannel(id)`, group events); coach chat paths unchanged.
- `features/chat/components/MessageBubble`, `ChatThread`: render sender name and tag for group messages, system lines (grey, centred, no bubble), hidden placeholder, "Seen by N" link, no tappable name for trainees; the PT-change alert row with Keep / Remove buttons only when `viewer.canResolveAlert`.
- `features/chat-groups/components/`: `GroupInboxSection`, `GroupThread` (wraps the shared thread, composer with managers-only banner), `GroupInfo` (members with Manager / PT / trainee label, mute, add / remove, rename, avatar, managers-only switch, dissolve for super admin), `CreateGroupForm` (name, photo, member picker scoped by role), `SeenBySheet`, `PtChangeAlertLine`.
- `app/admin/(protected)/messages/page.tsx`: "Groups" section above or below trainee chats; routes `app/admin/(protected)/messages/groups/new/page.tsx`, `.../groups/[groupId]/page.tsx`, `.../groups/[groupId]/info/page.tsx`; admin unread badge includes groups via the unread store (`features/chat/hooks/unread-store.ts`).
- `features/chat-bubbles`: make the bubble host ignore group chats (explicit guard + test), since groups are phase 2.
- Component or hook tests where the repo has the pattern; `pnpm verify`; `browser-proof` on a local DB (super admin creates a group, adds a trainee, PT-change alert Keep and Remove).

### PR 3: `feat/group-chat-trainee-ui` (trainee screens and push wiring)

- `app/(user)/(protected)/messages/(inbox)`: "Groups" section; `app/(user)/(protected)/messages/groups/[groupId]/page.tsx` and `.../info/page.tsx` (members list, mute, leave; no add or manage controls).
- Trainee-side wiring of `GroupThread` with `viewer` = trainee: managers-only banner, `chat off` and restricted banners (read allowed, composer disabled), no DM entry point (names not tappable).
- Tab bar and inbox unread badge include the group total (`use-chat-unread.ts` / unread store).
- Push end to end: confirm `sendGroupPush` is called from the send path for both roles, service-worker click opens the right group URL per owner kind (`public/sw.js` deep link handling, check `clear-notifications.ts` so opening a group clears its notifications).
- Add the group items to any notification-opt-in copy if needed; `messages` i18n test; `pnpm verify`; `browser-proof` as a trainee (read, send, leave, rejoin by admin, managers-only, muted push toggle).
- After merge: update the **pt-app Blueprint artifact** (add group chat: tables, channel, routes, PT-change alert) and note the date in the Deviations section here.

## Order of work

1. (PR 1) Wait for the block and report PRs to merge; rebase `feat/group-chat-core` on `main`.
2. Schema first (additive tables), then pure rules and Ably helpers with their tests.
3. `group-access` and `group-queries`, then actions and mutations, then system lines and the PT-change hook.
4. Realtime, push, photos and avatar services, API routes, unread payload field, cleanup in member and PT delete.
5. `pnpm verify`; open PR 1.
6. (PR 2) Characterization tests for thread rules, widen the viewer and message types, adapter and transport, shared components, admin screens, i18n, bubble guard.
7. `pnpm verify` plus `browser-proof`; open PR 2.
8. (PR 3) Trainee screens, badge, push deep links, i18n, `pnpm verify`, `browser-proof`; open PR 3.
9. Update the Blueprint artifact after PR 3 merges.

## Risks

- **Widening `ThreadViewer` and the message types** touches the coach chat's hottest code. Contained by optional fields, characterization tests first, and a fallback: if the union change spreads too far, a separate `GroupThread` wrapper takes a `GroupViewer` and maps messages before they reach the shared bubbles.
- **Access leaks**: group ids are guessable integers. Every route, action, photo, avatar and token request goes through `loadGroupActor`; 404 for non-members; tested per route.
- **Super admin implicit membership**: queries must union explicit rows with `admins.role` every time; push, unread, seen-by and the member list share one helper to avoid drift. Super admin without a state row: unread baseline is `admins.created_at`.
- **PT-change alert correctness**: unchanged value must be a no-op; alert rows must never reach trainee or PT queries, unread, push or seen-by (`audience` filtered in the shared query helper); resolve is one guarded update. A failing alert insert must not roll back the PT assignment.
- **Block-user dependency**: the restriction check name is not known yet. Only `loadTraineeRestriction` depends on it; PR 1 does not start until that PR merges.
- **Member cap race**: count and insert in one transaction; a unit test covers 50 to 51.
- **Ably token lifetime** (15 min): tokens are per open group, minted on connect and renewed by the existing refresh path; a removed member keeps a valid token up to 15 minutes but every refetch and send is rejected server-side, so no text is exposed beyond ids-only events.
- **Cleanup without foreign keys**: member and PT deletion must call the new cleanup or rows dangle; tested.
- **Production schema push**: new tables only, no change to existing tables, so `drizzle-kit push` on Vercel stays safe.
- **Push volume**: 50 members per message; delivery is already batched per locale; muted and sender are excluded before sending.

## Proof

- `pnpm verify` on every PR (paste the tail); unit tests listed above cover the spec test matrix.
- Browser proof (`browser-proof`, local SQLite): super admin creates a group, a PT creates one and sees only own trainees in the picker, trainee reads and sends, managers-only blocks the trainee, chat off blocks the trainee, mute stops push badge, leave and re-add, dissolve hides the group, PT change shows the alert to the super admin only and Keep / Remove each resolve once.
- Checks that nothing leaks: trainee cannot open another group by id (404), cannot reach a DM from a name tap, never sees `audience = super_admin` lines.

## Deviations

Update this section in the same commit whenever the implementation departs from the plan: what changed and why.

### PR 1 (`feat/group-chat-core`), 2026-11-14

- **Report kind left out.** The report PR (#201) is not merged, so `social_reports.target_kind` has no `'group_message'`, there is no group report action, and `MessageActionsSheet`, `social_reports` and `chat-moderation.ts` are untouched. A later PR adds the kind, the membership-checked report and the super admin page link.
- **Restriction check** is `restrictionErrorFor(userId)` from `features/restrictions/services/restriction-guard.ts`, wrapped by `loadTraineeRestriction` in `group-access.ts` (the single seam, as planned) and applied in `resolveSendBlock` for trainees only, beside `chatEnabled`.
- **No edit or unsend time window.** The spec says to reuse the windows of `chat-rules.ts`, but the coach chat has none (own messages, no time limit), so group edit and unsend have none either.
- **No admin or PT delete action exists in the repo**, so `removeAdminFromGroups` is written and tested but has no caller yet; `removeUserFromGroups` is wired into `deleteMemberAction`.
- **Errors localized through the `errors` namespace** (new group `chatGroups` in vi, en and zh, covered by `localize-message.test.ts`), not a new `chatGroups.json` namespace; that file comes with the UI PR.
- **PT-change alerts never move the inbox pointer** (`last_message_*`), so an alert cannot change the preview or the order for anyone who may not read it.
- **A new member starts with nothing unread** (cursor = the group's last message id); a re-added member keeps the old cursor. History stays fully readable (G8).
- **Super admin unread** keeps the `admins.created_at` baseline even when a state row exists (a mute alone creates one), so a mute never floods a new super admin with old unread.
- **Two extra service files** because a `'use server'` file may only export async functions: `group-core.ts` (the operations) and `group-membership.ts` (add, remove, leave), with `group-actions.ts` holding one export per role. Helpers `group-api.ts` (route session, `?as=admin` like the other chat routes) and `group-names.ts` (alias-aware names) were added.
- **`/api/chat/unread` and `unread-payload.ts`** gain `groups`; two parsers return it and the existing `chat-routes` test expectations include the new field. No existing field changed.
- **`assignTraineePtAction`** now answers success without writing when the PT is unchanged and returns "user not found" before any write.

### PR 2 (`feat/group-chat-admin-ui`), 2026-11-14

- **GroupThread wrapper, not a widened ChatThread.** Characterization tests (`chat-thread-viewer.test.ts`) came first, then `ThreadViewer` gained a `member` role (senderKey based) and `buildThreadItems` got system lines. `CoachViewer` (the old two roles) keeps the coach-only components (ChatThread, ChatInfo, customize panel, StickerPanel) unchanged.
- **`thread.deletedMember`** added to `format.json` for senders removed from the system.
- **Reactor names are not shown for groups.** Group reactions arrive aggregated, so reaction chips open the actions sheet rather than ReactorsSheet.
- **Hide / unhide** reuses `MessageActionsSheet` through a new optional `extra` slot; the #201 `onReport` prop is untouched.
- **Additive server view fields** in `GroupMessageView` (`photo`, `eventNames`, `replyTo.senderKey/unavailable/isSticker/isPhoto`) and `GroupLastMessage.media`, needed to render the shared bubble. No rule changed.
- **New `group-candidates.ts` service** for the create picker (PT: own non-hidden trainees; super admin: all trainees plus PTs).
- **`bubble-payload.ts`** extracted from the bubble host so that ignoring groups is explicit and tested.
- **Admin badge** (home initial count and polled count) now includes group unread via `adminBadgeCount`.
- **`useChatTransport`** takes an optional `groupId` (token `?group=<id>`, no user channel, no typing).
- **No new server actions**; every screen calls the PR 1 admin variants.
- Seen-by sheet and the PT-change alert line (Keep / Remove, resolved state) are wired but only unit-tested, not browser-proven.
