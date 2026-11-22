# Plan: mobile backend (Expo app: posts feed and messenger)

Plan as built, committed next to the spec.

## Source

- Intent: none (requested directly by Hoan)
- Spec: `docs/specs/mobile-backend.md`
- KAN key: none (see Deviations)

## Files that change

- `packages/contracts/src/push/{rules,schemas}.ts`: Expo token and platform schemas.
- `packages/contracts/src/reaction-emoji.ts`, `index.ts`, `chat/`, `chat-groups/`, `social*.ts`: one `isReactionEmoji` rule (one grapheme, 64 bytes, emoji shape) replaces the fixed reaction lists.
- `packages/contracts/src/chat/schemas.ts`, `chat-groups/schemas.ts`: `appBadge` on the unread response, `unsentAt` and the original-message views.
- `apps/api/src/push/**`: `ExpoPushSender` (batches of 100, ticket classification, 10 s timeout), `POST /push/devices`, `sendMany` and partial retry in `PushService`, badge on Expo payloads.
- `apps/api/src/chat/app-badge.service.ts`, `chat-messages.controller.ts`, `chat.module.ts`: `appBadge` on `GET /v1/chat/unread`, reusing the numbers the poll already has.
- `apps/api/src/{chat,dm,chat-groups}/**`: unsend keeps content, photo routes refuse unsent photos, super admin "original" routes.
- `apps/api/src/config/env.schema.ts`, `.env.example`, `docker-compose.yml`: optional `EXPO_ACCESS_TOKEN`.
- `apps/api/openapi.json`, `apps/web/services/api/schema.d.ts`: regenerated.
- `apps/web/**`: reaction lists kept locally in the web; one test uses a non-emoji value.

## Order of work

1. Contracts: Expo token schemas, then the any-emoji rule (no schema change in the database).
2. Expo sender and device registration, then `PushService.sendMany`.
3. App badge service and the `appBadge` field on unread and in Expo pushes.
4. Unsend keeps content, photo guards, super admin original routes.
5. Native media check (Bearer only), pinned by a test.
6. Spec, then regenerate OpenAPI and web types.

## Risks

- A hung Expo request blocks the push queue: bounded by a 10 s timeout and retry.
- `GET /chat/unread` is polled often: appBadge reuses the poll's numbers and adds only groups (2 queries) and notifications (1).
- Stored reactions must stay valid: the shape rule still accepts every emoji stored before.
- Expo receipts are not polled, so dead tokens linger until a send ticket reports them.

## Proof

- `pnpm build:contracts`, `pnpm --filter @pt/contracts verify`, `pnpm --filter @pt/api test`, lint and typecheck.
- Tests: `expo-push.sender.test.ts`, `push.service.test.ts`, `app-badge.service.test.ts`, `reaction-emoji.test.ts`, `push-realtime-schemas.test.ts`, and the e2e suites `chat`, `dm`, `chat-groups`, `chat-media`, `social-engagement`, `avatars`.

## Deviations

- Google OAuth sign-in was dropped from scope by Hoan; the mobile app signs in with the existing credentials.
- No KAN ticket and no intent file: Hoan's recent feature PRs skip Jira, so this plan carries no key.
- Review fixes after the first build: `appBadge` reuses the unread numbers instead of recomputing them, the Expo fetch got a 10 s timeout, and the emoji rule now requires the whole grapheme to match an emoji shape.
- Expo push receipts are not polled yet (follow-up).
