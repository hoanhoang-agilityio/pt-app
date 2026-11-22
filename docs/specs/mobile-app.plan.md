# Plan: mobile-app

Plan as built for the Expo app in `apps/mobile`, committed next to the spec.

## Source

- Intent: none (the request came in chat from Hoan)
- Spec: `docs/specs/mobile-app.md`
- KAN key: none (see Deviations)

## Files that change

- `packages/contracts/`: shared Zod contracts consumed by the app (`pnpm build:contracts`); `chat/schemas.ts` gains an optional `appBadge` on the unread response.
- `apps/mobile/app/`: Expo Router routes (tabs, login, compose, post, profile, notifications, sessions, chat screens), thin.
- `apps/mobile/src/features/{auth,feed,chat,push,me}`: screens, hooks and API calls per feature.
- `apps/mobile/src/lib/`: pure logic (API client, session refresh, photo pipeline, chat model, realtime event mapping, push routes and pending tokens, badge, API URL resolution).
- `apps/mobile/src/i18n/`: vi (default), en, zh.
- `apps/mobile/app.config.ts`, `README.md`: build config (API URL check, Android cleartext only in development) and docs.

## Order of work

1. Contracts package and API client, secure token store, session refresh rules (tests first for the pure parts).
2. Auth: login (trainee and admin), bootstrap, forced sign-out on 401.
3. Feed: posts, reactions, comments, profiles, photo pipeline, notifications.
4. Messenger: coach chat, groups, read-only trainee DMs, realtime (socket.io).
5. Push: registration, tap routing, unregister, badge. Me tab and signed-in devices.
6. Docs: README, spec, this plan. Review fixes: push cleanup on forced sign-out, notification handled once, badge, API URL guard, foreground refresh.

## Risks

- Push token left on the old account after a forced sign-out: queued and retried on the next launch or sign-in; sign-in registers again so the server upsert moves the token.
- A non-development build pointing at localhost: `app.config.ts` throws when `EXPO_PUBLIC_API_URL` is missing.
- Cleartext HTTP in release builds: only development builds allow it.
- Schema change: `appBadge` is optional, so older API versions keep working.

## Proof

- `pnpm build:contracts && pnpm --filter @pt/mobile verify` (Vitest in `src/lib/__tests__`: api-client, chat-model, emoji, image-plan, message-reactions, push-routes, push-pending, badge, api-url, reactions, realtime-events, session-refresh, time; i18n key parity; lint; typecheck).
- `cd apps/mobile && npx expo export --platform android` bundles the app.
- No browser proof: the UI is React Native.

## Deviations

- Google sign-in was dropped by Hoan; the app signs in with email and password (trainee) or username and password (admin) only.
- Two PRs instead of one per phase.
- No KAN ticket: Hoan's recent feature PRs skip Jira, so no key appears in the branch or commits.
- The spec was written alongside the build, not before it, because Hoan asked for an uninterrupted end-to-end build; this plan records what was built.
