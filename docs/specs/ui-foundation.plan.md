# Plan: UI foundation (tokens, brand fonts, Nhịp Tĩnh palette, slop removal)

## Source

- Intent: none (approved directly by Hoan from the UI audit proposal)
- Spec: UI audit proposal `pt-app-ui-audit-proposal.md`, "Phased rollout" items 1-3 plus the extra micro-PR "Phase 3b" (remove slop). Findings §5-6 and "Slop signs found" explain why.
- Design brief: `redesign-2026/BRIEF.md` (Nhịp Tĩnh)
- Jira: skipped by Hoan

## Files that change

Phase 1, `refactor/design-tokens` (this branch):

- `app/globals.css`: `@theme inline` gains radius (`--radius-control|card|panel|sheet|dock|dock-item`), shadow (`--shadow-pop|dock`), type scale (`--text-nano..lead`) and `--color-scrim`.
- `constants/styles.ts`: `CARD`, `BUTTON_*`, `INPUT*`, `ICON_BUTTON_BASE` use the radius tokens.
- `utils/cn.ts` + test: tailwind-merge learns the new token names so `text-body text-fg` is not collapsed.
- About 45 components: `rounded-[...]`, arbitrary shadows, `text-[Npx]` and `bg-black` swapped for the matching token, 1:1 (same computed value).

Phase 2, `feat/brand-fonts`: `app/layout.tsx` loads Bricolage Grotesque and Be Vietnam Pro through `next/font/google` (vietnamese subset) and exposes CSS variables; `app/globals.css` maps them to `--font-sans` and `--font-display`.

Phase 3, `refactor/nhip-tinh-palette`: `app/globals.css` neutrals and accent, `features/theme/constants/theme.ts` `DEFAULT_ACCENT`, background constants and presets only where they assert the old default.

Phase 3b, `refactor/remove-ui-slop` (stacked on phase 1): accent glows, gradient card, tracked uppercase labels, `transition-all`, edit-mode pulse, exclamation marks and the "Xin chào" eyebrow in vi/en/zh.

## Order of work

1. Tokens (no visual change except where noted).
2. Fonts.
3. Palette (default accent and neutrals only; the admin/personal theme override keeps winning).
4. Slop removal on top of the tokens.

No schema change in any phase.

## Risks

- Visual diff everywhere in phases 1 and 3: contained by 1:1 token values in phase 1 and by keeping the override path in phase 3.
- Font loading (CLS, Vietnamese glyphs) in phase 2: `display: swap` with a system fallback and size-adjust from next/font.
- Phase 3 touches `DEFAULT_ACCENT`: tests asserting the old literal default change with it.

## Proof

- `pnpm verify` on every branch (e2e skipped).
- `utils/__tests__/cn.test.ts` covers the token names in tailwind-merge.
- Browser check of home, nutrition, chat and admin dashboard in light and dark (`browser-proof`) before merging.

## Deviations

None yet.
