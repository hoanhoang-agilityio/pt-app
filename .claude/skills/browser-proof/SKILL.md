---
name: browser-proof
description: Prove a pt-app UI change end to end in a real browser (Playwright MCP against pnpm dev and a local SQLite DB), screenshot each step, check console and network, and report in an artifact. Use on "test it in the browser", "prove it works", "record a GIF", or before a UI PR.
---

# Prove it in the browser

Unit tests prove the parts; the browser proves the feature. pt-app is mobile-first, so test at phone width first.

## Setup

1. **Local database only.** Check that `DATABASE_URL` points at a `file:` SQLite database (ask the user if unsure; never read `.env*` yourself). Never test against Turso or production.
2. Fresh local DB if needed: `pnpm db:push`, `pnpm admin:create`, then `pnpm db:seed-demo` for the "Demo" user with this week's schedule. These commands ask for permission; that is expected.
3. **Start the app** with `pnpm dev` in the background (http://localhost:3000, or `pnpm dev --port 3100` when another session holds 3000). Wait until it answers.
4. Use the `playwright` MCP server from `.mcp.json`; its output goes to the ignored `.playwright-mcp/`. Set the viewport to a phone (e.g. 390x844) unless the change is admin-only desktop UI.

## Procedure

1. **Drive the real flow** from a clean state, the way a user would:
   - Member: `/` (log in by name, e.g. "Demo"), then `/workouts`, `/summary`, `/nutrition`.
   - Admin (PT): `/admin/login`, then `/admin`, `/admin/users/<id>` and its `summary`, `preview`, `nutrition` pages.
2. **Read what a user cannot see**: console errors and warnings, failed or slow network requests, server errors in the `pnpm dev` output.
3. **Screenshot each step**, including the states from the spec: loading, empty, error, success, and Vietnamese copy fitting on a narrow screen. For a multi-step flow, record a GIF or stitch the screenshots.
4. **Stop and ask** if the same step fails three times in a row; do not keep clicking.
5. **Report in an artifact**: what was tested, a screenshot per step, the GIF, console/network findings, pass/fail per acceptance criterion (from the KAN ticket or `docs/specs/<feature>.md`), and two lines of release notes.
6. **Make it repeatable**: once the flow passes by hand, offer to turn it into a Playwright test (as its own KAN ticket if the repo has no e2e suite yet).

## Rules

- Never claim a pass you did not observe. If a step was skipped, say so.
- Do not change production data, send real messages or share the dev server publicly unless asked.
- Stop the dev server when done.
- Link the artifact in the PR's "How it was verified" section.
