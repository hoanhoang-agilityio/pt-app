# Claude Code setup: what is in the repo, what you do on your machine

The repo already carries the team setup (dojo Day 01-10, Jira epic KAN-9). This page lists what it does and the steps each developer runs locally, because they need your own login, secrets or machine.

## What the repo gives you

| Path                                 | What it does                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                          | Team rules loaded into every session: commands, layout, conventions, never-do list.                                             |
| `.claude/settings.json`              | Permissions (allow / ask / deny) and the two hooks below.                                                                       |
| `.claude/hooks/block-forbidden.mjs`  | Before each Bash command: blocks push to `main`, force-push, `--no-verify`, Claude trailers in commits, shell access to `.env`. |
| `.claude/hooks/format-on-edit.mjs`   | After each Edit/Write: `eslint --fix` on JS/TS files, then Prettier, using the repo's own config.                               |
| `.claude/agents/bug-investigator.md` | Read-only subagent that reproduces a bug and reports the root cause with `file:line`.                                           |
| `.claude/skills/review-checklist/`   | Team review checklist, used by `/code-review` style reviews and before merging.                                                 |
| `.claude/commands/standup.md`        | `/standup [since]`: drafts a standup from your commits and KAN tickets (see below).                                             |
| `.mcp.json`                          | Playwright MCP, so a session can open and check the app on http://localhost:3000.                                               |
| `docs/review-false-positives.md`     | Review findings that are by design; add rows during Day 10 and the retro.                                                       |

Use Node.js 24 (the app's `engines`, also what Vercel builds with); the hooks and MCP run on it too. After pulling, run `npm ci` (installs exactly the lock file; `npm install` may rewrite it), then restart Claude Code so it loads the new settings.

## `/standup`

`/standup` (or `/standup last friday`) reads `git log` for commits by your git email since the given day (default: yesterday), groups them by KAN key, and, when the Atlassian connector is on, adds the status of those tickets and your In Progress tickets. It prints three short sections, **Done**, **Today** and **Blockers**, to read aloud. It only reads; it never posts anywhere. Edit `.claude/commands/standup.md` to change the format.

## Steps to do on your machine

### 1. Approve the project settings (once)

1. Open the repo in Claude Code (Desktop Code tab or `claude` in a terminal).
2. Accept the prompt to trust the project and enable the `playwright` MCP server.
3. Check with `/hooks` (both hooks listed), `/mcp` (playwright connected) and `/agents` (bug-investigator listed).

### 2. Notify-on-finish (personal, per machine)

Create `.claude/settings.local.json` (gitignored) with a `Stop` hook for your OS.

macOS:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude is done\" with title \"pt-app\"'"
          }
        ]
      }
    ]
  }
}
```

Windows (PowerShell):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "powershell -NoProfile -Command \"[console]::beep(800,300)\""
          }
        ]
      }
    ]
  }
}
```

Restart the session and finish any prompt to test it.

### 3. GitHub connector (Day 08)

GitHub's MCP endpoint does not support the automatic OAuth sign-in (`/mcp` shows "does not support dynamic client registration"), so use a personal access token.

1. On GitHub: Settings > Developer settings > Fine-grained tokens > Generate. Repository access: only `pt-app`; permissions: Contents read, Pull requests read and write, Issues read and write. Copy the token; never paste it into a chat or a repo file.
2. Store it as a user environment variable `GITHUB_PAT` (Windows: System Properties > Environment Variables; macOS: `export GITHUB_PAT=...` in `~/.zshrc`), then open a new terminal.
3. Add the server at user scope, so the repo's `.mcp.json` stays unchanged. If an earlier attempt added it, run `claude mcp remove github -s user` first.
   `claude mcp add --scope user --transport http github https://api.githubcopilot.com/mcp/ --header "Authorization: Bearer $GITHUB_PAT"` (PowerShell: `$env:GITHUB_PAT`)
4. `claude mcp list` should show `github: ✓ Connected`.
5. Test it: ask Claude to list open PRs in `hoanhoang-agilityio/pt-app` and comment on one.

### 4. `@claude` in GitHub Actions (Day 09)

1. In Claude Code inside this repo, run `/install-github-app`.
2. Follow the prompts: install the Claude GitHub App on `hoanhoang-agilityio/pt-app` and let it add the `ANTHROPIC_API_KEY` (or OAuth token) repo secret. Never paste the key into a file or chat.
3. Merge the workflow PR it opens.
4. Test it: comment `@claude review this PR` on a PR and evaluate the comments.

### 5. Hands-on exercises (no repo change needed)

| Day | Exercise                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------- |
| D04 | Cycle permission modes with Shift+Tab (Windows: Alt+M); run one KAN ticket through plan mode to PR.              |
| D05 | `/memory`, `/compact` on a long session, Esc Esc to `/rewind` a bad edit; compare a fresh vs a warmed session.   |
| D06 | `/loop 15m` on your PR, `/rc` and steer from the phone, two tickets in parallel with `claude --worktree <name>`. |
| D07 | `/plugin`, install one plugin (e.g. a TypeScript LSP), write down an honest verdict.                             |
| D09 | `/goal` on a bounded task; a Local routine in Desktop (Code tab > Routines > New routine > Local).               |
| D10 | `/code-review` on a real branch, `/code-review ultra` on a seeded-bug branch, `/security-review` before commit.  |
