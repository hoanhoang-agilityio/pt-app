# App primary color (accent) chosen by the super admin

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

## Data (additive)

- New table `theme_settings`: `scope` text primary key (`all` | `trainee` | `pt`), `accent` text not null (`#rrggbb`), `updated_at`, `updated_by_admin_id` nullable FK to `admins`.
- New nullable column `admins.accent_color` (the super admin's `self` override).

## Test matrix

| Area | Case | Expected |
| --- | --- | --- |
| parseHex | `#F60`, `#FF6600` | `#ff6600`; a missing `#` is rejected; `#ff66`, `red`, `#gggggg`, `""` rejected |
| convert | `#e8590c` to rgb and hsl and back | (232, 89, 12), about (24, 90.9%, 47.8%), round trip exact |
| contrast | white vs black, white vs white | 21 and 1 |
| pickForeground | orange, yellow, navy | black, black, white |
| deriveDarkVariant | dark navy, default orange | lightened, at least 3:1 vs both dark surfaces |
| fixLightness | pale yellow on light | at least 3:1 on both light surfaces, hue unchanged, nearest lightness |
| resolveAccent | self + role + all, gaps, invalid values | precedence per D3, invalid values skipped |
| buildThemeCss | valid color / invalid | three blocks as in globals.css / null |
| action | PT or trainee calls it | refused by the guard before any write |
| action | scope `all` | trainee and pt rows deleted |
| action | bad color or scope | error result, nothing written |
