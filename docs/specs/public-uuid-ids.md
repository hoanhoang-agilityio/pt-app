# Spec: Public UUID ids

- **Intent:** `intent/2026-11-08-public-uuid-ids.md`
- **KAN key:** none (Hoan, 2026-11-08)
- **Status:** draft, waiting for Hoan's approval

## Decisions

1. **Additive `public_id` column, integer PK stays.** Every exposed table gets `public_id text` with a unique index. The integer `id` stays the primary key and every foreign key keeps pointing at it. (Hoan's decision card, 2026-11-08.)
2. **UUID v4 from `crypto.randomUUID()`**, set by Drizzle `$defaultFn` on insert. Column is nullable in the schema because SQLite cannot add a NOT NULL column without a default to a table with rows; the app treats it as required (type narrowed in queries, backfill guarantees it).
3. **Backfill in the build.** `scripts/setup-database.ts` gets `backfillPublicIds()` after `pushSchema()`, same pattern as `migrateHiddenConversations()`. It fills `public_id` where it is NULL, in batches, and is idempotent. It runs on Vercel (production and preview) and in `pnpm db:setup` locally.
4. **Boundary rule.** Integer ids live only inside services/queries. Everything that crosses to a client or out of the server uses `publicId`: route params, links, redirects and `revalidatePath`, hidden form inputs, server action and API inputs, JSON/DTO fields and client props, Ably channel names, clientIds and event payloads, push `url`/`tag`, avatar, photo and sticker URLs, pagination cursors.
5. **Validation.** One shared `publicIdSchema = z.uuid()` in `utils/` replaces `z.coerce.number()` id schemas at the boundary. A numeric or malformed id fails validation (actions) or returns 404 (pages, API routes). No fallback lookup by integer id.
6. **Lookup helpers.** Each feature service gets `find<Entity>ByPublicId()` and resolves to the internal id once at the boundary; existing internal queries keep taking integers.
7. **Ordering.** `orderBy(id)` used as a tie-breaker stays (it is internal and monotonic). Chat pagination cursors (`before`, `lastReadMessageId`) become message `publicId`s; the server resolves them to the internal id and keeps the current id-based cursor logic. No ordering change.
8. **Session cookie unchanged.** It keeps integer `userId`/`adminId` (signed JWT, httpOnly). Ably token capabilities are built server-side from it, mapped to public ids.
9. **Old URLs 404.** No redirect from numeric URLs (they are the guessable surface we are closing).

## Tables

| Gets `public_id` | Why |
| --- | --- |
| users, admins | admin member URLs, avatar URLs, Ably channels/clientIds, push url, hidden-user list, chat sender ids |
| foods | `/foods/[id]`, `/admin/foods/[id]`, food picker, meal plan and meal log inputs |
| meal_plan_days, meal_plan_meals, meal_plan_items | meal plan editor actions and DTOs |
| meal_logs | meal log actions |
| exercises | exercise form, set logging, completion actions |
| food_entries | food entry form and actions |
| chat_conversations | admin chat API routes, Ably channel, push tag, profile actions, typing |
| chat_messages | message edits routes, reply/react/edit/unsend inputs, read cursor, gallery/search cursors, Ably payloads |
| chat_photos | `/api/chat/photos/[id]`, send-photo input, gallery |
| chat_custom_stickers | `/api/chat/stickers/custom/[id]`, sticker send input |

Not exposed, no column: workout_days, exercise_sets, exercise_completions, nutrition_targets, body_profiles, weight_logs, meal_marks, meal_mark_items, chat_reactions, chat_message_edits, chat_nicknames, chat_color_overrides, chat_hidden_conversations, admin_hidden_users, chat reads, push_subscriptions, login_attempts, rate_limits. If a phase finds one of these exposed after all, it gets the column in that phase and this table is updated.

## Phases (one PR each, into `stag`)

1. **Foundation + users/admins.** `publicIdSchema`, schema columns for users and admins, backfill step, `utils/routes.ts` helpers take public ids, admin `users/[id]/*` pages, member actions and every hidden `userId`/`targetUserId` input, avatar route and URLs, presence and photo-list `userId` query params, push url, hidden-user list.
2. **Foods + meal plan + meal logs.** foods, meal_plan_days/meals/items, meal_logs columns; food pages and actions; meal plan and meal log schemas, DTOs and editors.
3. **Workouts + nutrition entries.** exercises, food_entries columns; workout, set and completion actions; food entry form.
4. **Chat.** chat_conversations, chat_messages, chat_photos, chat_custom_stickers columns; admin chat API routes, message edit routes, chat actions and schemas, cursors, Ably channel names, clientIds, capabilities (`assertId`) and payloads, push tag, photo and sticker URLs. Clients connected during the deploy get new tokens on reconnect.

Each phase is deployable alone: earlier phases never depend on later ones.

## Rollback

Revert the phase's PR. The added column and its values stay in the DB and are ignored by the old code (additive). Re-applying the PR later reuses the same UUIDs, so links shared in between stay valid.

## Test matrix

| Case | Where |
| --- | --- |
| `publicIdSchema` accepts a v4 UUID, rejects `"3"`, `3`, `""`, malformed strings | `utils/__tests__/public-id.test.ts` |
| Backfill fills only NULL rows, is idempotent, leaves existing UUIDs untouched | `services/__tests__/backfill-public-ids.test.ts` (in-memory libSQL) |
| Inserts get a UUID by default | same file |
| Route helpers build paths from public ids | `utils/__tests__/routes.test.ts` |
| Admin member page with numeric id or unknown UUID → 404 | service test for `findUserByPublicId` |
| Action with a numeric `userId` fails validation | member/workout/nutrition/meal-plan schema tests |
| Ably channel names and capabilities use public ids; `assertId` rejects integers | `features/chat/utils/__tests__/ably-capabilities.test.ts` |
| Chat cursors resolve from message public id; unknown cursor → empty page, not error | chat query tests |
| Push payload url/tag contain public ids only | `push-rules` tests |
| No integer id in any DTO sent to the client | per-phase grep check in the PR (`id:` fields in DTO types are `string`) |

e2e specs and `e2e/seed.ts` hard-code numeric ids; they are updated in each phase but not run (e2e skipped by Hoan, 2026-11-08).
