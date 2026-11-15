# Plan: App primary color

## Source

- Intent: none (owner request in chat)
- Spec: `docs/specs/accent-color.md`
- KAN key: No Jira ticket (owner skipped Jira)

## Files that change

- `db/schema.ts`: `theme_settings` table, `admins.accent_color` (additive).
- `features/theme/utils/*`: pure color math, contrast, derivation, precedence, CSS builder, with tests.
- `features/theme/services/*`: cached read, viewer resolution, `setAccentColorAction`.
- `app/layout.tsx`: injects the override style; `app/globals.css`: `--chart-weight: var(--accent)`.
- `app/admin/(protected)/settings/theme/*`: super-admin-only page and loading screen.
- `features/theme/components/*`, `features/theme/hooks/*`: settings screen UI.
- `components/layout/HeaderMenus`, `app/admin/(protected)/(home)/page.tsx`: gear menu entry for the super admin.
- `constants/routes.ts`, `i18n/*`, `messages/{vi,en,zh}/{theme,layout,errors}.json`: strings.

## Order of work

1. Docs (this plan and the spec).
2. Schema, `pnpm db:push` on the local SQLite only.
3. Pure utils and their tests.
4. Service, action, layout injection.
5. UI and strings.
6. `pnpm verify`, `pnpm build`.

## Risks

- A bad stored value breaking the page: only normalized `#rrggbb` is interpolated, and a failed read falls back to the default.
- Every route is already dynamic (theme cookie), so the extra read is one cached query plus one admin row lookup.

## Proof

- Vitest for every util and the messages test; `pnpm verify`; `pnpm build`.

## Deviations

- Foreground is pure black or white (not black-ish): a near-black like #111113 can fall under 4.5:1 on mid colors, pure black always reaches 4.58:1.
- Cache uses `unstable_cache` + `updateTag` because Cache Components is not enabled in `next.config.ts`.
- Live preview shows app elements (button, chip, toggle, progress bar, bottom tab bar), not a chat bubble: this is the app color, not a message color.
- The override `<style>` sits at the start of `<body>` so it comes after `globals.css` in document order.
