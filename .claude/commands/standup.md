---
description: Draft my daily standup from git history and my KAN tickets
argument-hint: "[since, default: yesterday]"
allowed-tools: Bash(git log:*), Bash(git branch:*), Bash(git status:*)
---

Draft my standup for pt-app in English, short enough to read aloud in one minute.

Since: $ARGUMENTS (if empty, use "yesterday"; on a Monday use "last friday").

1. Run `git log --all --author="$(git config user.email)" --since="<since>" --format="%h %ad %s" --date=short` and `git branch --show-current`.
2. Group commits by the KAN key in the subject. If the Atlassian connector is available, look up those keys plus my In Progress tickets in project KAN and use their status; otherwise use only git.
3. Write three sections:
   - **Done**: one line per ticket, key first.
   - **Today**: what is next on the current branch or the next In Progress ticket.
   - **Blockers**: only real ones (waiting on review, a question, a failing check), or "None".

Do not invent work that is not in git or Jira.
