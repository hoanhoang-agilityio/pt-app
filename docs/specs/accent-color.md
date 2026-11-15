# App primary color (accent): super admin defaults and personal colors

No Jira ticket (owner skipped Jira). Owner-approved. This is the app's primary color (buttons, active tabs, chips, rings), not a chat or message color; the chat "neutral colours" switch is unchanged.

## Goal

The super admin picks the primary (accent) color for themselves, for all trainees, for all PTs, or for everyone. Today the orange lives only in CSS tokens in `app/globals.css`; overriding `--accent`, `--accent-fg` and `--chart-weight` recolors every component.

## Decisions

- D1 Only the super admin changes it (`requireSuperAdmin()`, which calls `requireAdmin()` first). PTs are redirected from the settings page; trainees have no entry.
- D2 Scopes: `self` (the super admin only), `trainee` (all trainees), `pt` (all PTs), `all` (everyone).
- D3 Precedence: self override > role color (trainee or pt) > `all` color > default orange. A super admin without a self override uses `all`, then the default. Anonymous visitors (login pages) use `all`.
- D4 Saving scope `all` clears the `trainee` and `pt` rows. Each scope can be reset: color `null` deletes the row (or nulls `admins.accent_color` for `self`).
- D5 Free choice: native color input, HEX field, RGB sliders, HSL sliders and 8 preset swatches. The admin picks ONE color; the app derives the dark-mode variant and the foreground.
- D6 Contrast (WCAG): `--accent-fg` on accent must be at least 4.5:1 (white or black, whichever is higher); accent against the light `--bg` #f4f4f5 and `--surface` #ffffff must be at least 3:1. A failing pick shows a warning badge and a "fix lightness" button (nearest passing HSL lightness). Saving is never blocked and the server stores what was chosen.
- D7 The derived dark variant always passes 3:1 against the dark `--bg` #0c0c0e and `--surface` #18181b (lightness is raised until it does).
- D8 App icon and PWA theme-color are unchanged.
- D9 Only normalized `#rrggbb` values are ever written into the page `<style>`; a stored value that fails normalization is ignored (default color).
- D10 The reading of `theme_settings` is cached with the tag `theme-settings` (`unstable_cache`) and invalidated on save (`updateTag`), plus `revalidatePath("/", "layout")`.
- D11 When one browser holds both an admin and a trainee session, the admin session decides which color applies.

## Follow-up: everyone picks their own color (approved)

- D12 Trainees, PTs and the super admin each pick a personal app color from the gear (Cài đặt) menu entry "Màu chủ đạo của app". It applies only to that person. The same ColorPicker, ThemePreview and ContrastNotice are reused (presets, native picker, HEX, RGB, HSL, light and dark preview, reset). D1 is superseded: the super admin still owns the role and `all` colors and the locks; the personal color is open to everyone.
- D13 Personal storage: trainee `users.accent_color` (new nullable column); PT and super admin `admins.accent_color` (now honoured for PTs too).
- D14 Routes: trainee `/settings/theme` (`ROUTES.SETTINGS_THEME`, under `(user)/(protected)`); admins `/admin/settings/theme`, which renders the four-scope screen for the super admin and a personal-only picker for a PT (one admin URL and one menu link, no redirect for PTs). Both `proxy.ts` matchers cover `/settings/*`.
- D15 Locks: the super admin screen has two switches, "Khoá đổi màu cho PT" and "Khoá đổi màu cho học viên", default unlocked. Stored in `theme_locks` (`scope` trainee|pt, `locked`, `updated_at`, `updated_by_admin_id`); no row = unlocked. Locks apply to roles, never to the super admin.
- D16 Resolution. Unlocked: personal > role color > `all` > default. Locked: personal ignored, role color > `all` > default. Super admin: self > `all` > default (never locked). Personal colors stay in the database while locked and come back when unlocked. `resolveAccent` takes a `locked` flag that skips the personal layer.
- D17 While locked: the gear entry is hidden, the personal page redirects (trainee to workouts, PT to the admin home), and `setMyAccentColorAction` returns `THEME_MESSAGES.LOCKED` (localized through `errors.json` `theme.LOCKED`) for both a save and a reset. The lock is read fresh from the database in the action, never from the cache.
- D18 Actions. `setMyAccentColorAction({ color | null, audience? })`: the guard runs first (`requireUser()` for a trainee, `requireAdmin()` for a PT or super admin), then Zod, `normalizeHex`, the lock check, the write. `audience` is sent by the picker page because one browser can hold both sessions; without it the admin session wins (D11). `setThemeLockAction({ scope: "trainee" | "pt", locked })` uses `requireSuperAdmin()` and upserts the row. `setAccentColorAction` is unchanged.
- D19 Locks are cached with the same `theme-settings` tag (`getThemeLocks`) and invalidated by every save (`updateTag`).
- The wording is always the APP color, never a chat or message color.

## Data (additive)

- New table `theme_settings`: `scope` text primary key (`all` | `trainee` | `pt`), `accent` text not null (`#rrggbb`), `updated_at`, `updated_by_admin_id` nullable FK to `admins`.
- New nullable column `admins.accent_color` (the admin's personal color; first only the super admin's `self`, now PTs too).
- New nullable column `users.accent_color` (the trainee's personal color).
- New table `theme_locks`: `scope` text primary key (`trainee` | `pt`), `locked` integer boolean not null, `updated_at`, `updated_by_admin_id` nullable FK to `admins` (set null). No row = unlocked.

## Test matrix

| Area                                      | Case                                                                       | Expected                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| parseHex                                  | `#F60`, `#FF6600`                                                          | `#ff6600`; a missing `#` is rejected; `#ff66`, `red`, `#gggggg`, `""` rejected |
| convert                                   | `#e8590c` to rgb and hsl and back                                          | (232, 89, 12), about (24, 90.9%, 47.8%), round trip exact                      |
| contrast                                  | white vs black, white vs white                                             | 21 and 1                                                                       |
| pickForeground                            | orange, yellow, navy                                                       | black, black, white                                                            |
| deriveDarkVariant                         | dark navy, default orange                                                  | lightened, at least 3:1 vs both dark surfaces                                  |
| fixLightness                              | pale yellow on light                                                       | at least 3:1 on both light surfaces, hue unchanged, nearest lightness          |
| resolveAccent                             | self + role + all, gaps, invalid values                                    | precedence per D3, invalid values skipped                                      |
| buildThemeCss                             | valid color / invalid                                                      | three blocks as in globals.css / null                                          |
| action                                    | PT or trainee calls it                                                     | refused by the guard before any write                                          |
| action                                    | scope `all`                                                                | trainee and pt rows deleted                                                    |
| action                                    | bad color or scope                                                         | error result, nothing written                                                  |
| resolveAccent (locks)                     | unlocked, self + role + all                                                | self wins                                                                      |
| resolveAccent (locks)                     | locked, self + role + all                                                  | role wins                                                                      |
| resolveAccent (locks)                     | locked, no role color                                                      | all, then the default (null)                                                   |
| resolveAccent (locks)                     | invalid personal color, unlocked                                           | falls through to role                                                          |
| viewer accent                             | trainee unlocked / locked / PT lock on                                     | personal / trainee color / personal                                            |
| viewer accent                             | PT locked, then unlocked                                                   | role color, then the personal color back                                       |
| viewer accent                             | super admin with both locks                                                | self, then `all`; never locked                                                 |
| personal page state                       | locked trainee, locked PT, super admin                                     | locked true, true, false (never)                                               |
| setMyAccentColorAction                    | trainee saves `#2563EB`                                                    | `users.accent_color` = `#2563eb`; admins untouched; tag invalidated            |
| setMyAccentColorAction                    | trainee or PT while that role is locked (save and reset)                   | error `LOCKED`, stored color kept, no tag invalidation                         |
| setMyAccentColorAction                    | the other role's lock is on                                                | save still succeeds                                                            |
| setMyAccentColorAction                    | super admin with both locks                                                | saves                                                                          |
| setMyAccentColorAction                    | bad color (`red`, `#12`, `javascript:1`, `#fff;}</style>`) or bad audience | error, nothing written                                                         |
| setMyAccentColorAction                    | guard refuses (no session, locked admin)                                   | error result, nothing written                                                  |
| setMyAccentColorAction                    | no audience given                                                          | admin session decides, else trainee                                            |
| setThemeLockAction                        | pt lock on                                                                 | row with `locked`, `updated_by_admin_id`; other role untouched                 |
| setThemeLockAction                        | lock then unlock                                                           | same row updated to false; personal colors untouched                           |
| setThemeLockAction                        | scope `all`, non-boolean `locked`                                          | error, nothing written                                                         |
| setThemeLockAction / setAccentColorAction | non-super admin                                                            | guard refuses, nothing written                                                 |
