# @pt/mobile

Expo (React Native) app for the PT platform: feed (posts, reactions, comments, profiles), messenger (coach chat, groups, read-only trainee DMs, realtime), push notifications and a Me tab. Trainees also get workouts, nutrition, a week summary and profile settings (admin workouts are separate). Spec: `docs/specs/mobile-app.md`.

Stack: Expo SDK 58, Expo Router (typed routes), TypeScript strict, TanStack Query, socket.io-client, expo-secure-store, expo-image, expo-notifications, i18next (vi default, en, zh), `@pt/contracts` for Zod validation.

## Quick start

1. Start the backend (PostgreSQL 17 + API on http://localhost:4000) from the repo root:

   ```bash
   cp apps/api/.env.example apps/api/.env   # uncomment SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD
   docker compose up -d --build db api
   pnpm admin:create                         # one-time admin; pnpm db:seed-demo adds a local demo trainee
   ```

2. Install and build the shared contracts, then start the app:

   ```bash
   pnpm install
   pnpm build:contracts
   cp apps/mobile/.env.example apps/mobile/.env
   pnpm --filter @pt/mobile start
   ```

3. Open it in a development build (see below) or in Expo Go for a quick look (push notifications need a development build).

## Environment variables

Set in `apps/mobile/.env` (only `.env.example` is committed). Anything `EXPO_PUBLIC_*` is embedded in the bundle, so never put secrets here.

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:4000` (development only) | Base URL of the API (no trailing `/v1`). An empty value counts as unset. **Required** for every non-development EAS build (`EAS_BUILD_PROFILE` set and not `development`): `app.config.ts` fails with a clear error otherwise. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | unset | EAS project id for Expo push tokens. Without it push registration is skipped silently. |

`localhost` is the phone itself, so point `EXPO_PUBLIC_API_URL` at the computer running Docker:

- iOS simulator: `http://localhost:4000` works.
- Android emulator: `http://10.0.2.2:4000` (the emulator's alias for the host).
- Real phone on the same Wi-Fi: the computer's LAN IP, e.g. `http://192.168.1.20:4000` (find it with `ipconfig getifaddr en0` on macOS or `hostname -I` on Linux). The API must listen on all interfaces (the compose service does); allow port 4000 through the firewall.

Restart `expo start` (add `-c` to clear the cache) after changing it. Cleartext HTTP on Android is enabled only for development builds (local runs and the EAS `development` profile; `app.config.ts` sets `usesCleartextTraffic`). Preview and production builds are HTTPS only, so set `EXPO_PUBLIC_API_URL` to an `https://` URL in the EAS profile `env` (or as an EAS environment variable).

## Development build

Native modules (secure store, notifications, image picker) need a dev build for full behaviour.

```bash
cd apps/mobile
npx expo run:ios          # needs Xcode; or: npx expo run:android (Android Studio)
```

With EAS: `npm i -g eas-cli && eas login && eas build:configure`, then `eas build --profile development --platform ios|android`, install it and run `pnpm --filter @pt/mobile start`. Put the EAS project id in `EXPO_PUBLIC_EAS_PROJECT_ID`. Push needs the push credentials (APNs key, FCM) configured in EAS.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm start` / `android` / `ios` | Expo dev server / launch on a device. |
| `pnpm test` | Vitest for the pure logic in `src/lib` and the i18n key parity. |
| `pnpm lint` | ESLint (expo config, sorted imports, braces), zero warnings. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm verify` | test, lint and typecheck. |

`@pt/contracts` must be built (`pnpm build:contracts` at the root) before any script.

## Layout

```
app/                  Expo Router routes (thin): (tabs), login, compose, post/[id], profile/[key],
                      notifications, sessions, chat/{coach,trainee/[userId],group/[id],dm/[cid]}
src/features/         auth, feed, chat, push, me
src/components/       AuthImage (Bearer image loading), Avatar, Sheet, ReactionPicker, ui kit
src/lib/              API client, session refresh, photo pipeline, chat model, realtime event mapping
src/i18n/             vi, en, zh
```

## Notes

- Sign in with email and password (trainee) or the admin toggle (username and password). The opaque token lives in SecureStore.
- Push: every sign-in registers the device token again (the API moves it to the signed-in account). On sign-out, including a forced one (expired or revoked session), the token is unregistered best effort; a failed DELETE is remembered and retried on the next launch or sign-in. The app icon badge follows `appBadge` from `GET /v1/chat/unread` and is reset to 0 on sign-out.
- Photos are resized to at most 1600 px and compressed to JPEG under 1.5 MB before upload.
- Images are loaded with the Bearer header through the shared `AuthImage`.
