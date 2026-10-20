// Pure rules for the PreToolUse hook, kept separate so Vitest can cover them.

const PROTECTED_BRANCHES = ["main", "master"];

const ENV_FILE_PATTERN = /(^|[\s/"'=<])\.env(\.[\w.-]+)?(?=$|[\s"';|&)>])/g;

// The quoted text after -m / --message on a git commit.
const COMMIT_MESSAGE_PATTERN =
  /(?:-m|--message)(?:=|\s+)(?:"(?:[^"\\]|\\.)*"|'[^']*')/g;

const hasFlag = (command, flag) =>
  new RegExp(`(^|\\s)${flag}(?=$|[\\s=])`).test(command);

const pushTargetsProtectedBranch = (command, currentBranch) => {
  const args = command.replace(/^.*?\bgit\s+push\b/, "").trim();
  const positional = args
    .split(/\s+/)
    .filter((arg) => arg && !arg.startsWith("-"));
  // `git push origin feature:main` or `git push origin main`.
  const refs = positional.slice(1).map((ref) => ref.split(":").pop());

  if (refs.length > 0) {
    return refs.some((ref) =>
      PROTECTED_BRANCHES.includes(ref.replace(/^refs\/heads\//, "")),
    );
  }
  // A bare `git push` pushes the current branch.
  return PROTECTED_BRANCHES.includes(currentBranch);
};

// Returns the reason a Bash command is blocked, or null when it may run.
export const findViolation = (command, currentBranch = "") => {
  const isPush = /\bgit\s+push\b/.test(command);
  const isCommit = /\bgit\s+commit\b/.test(command);

  if (isPush && (hasFlag(command, "--force") || hasFlag(command, "-f"))) {
    return "Force-push is not allowed. Use --force-with-lease on your own branch only if you really must.";
  }
  if (isPush && pushTargetsProtectedBranch(command, currentBranch)) {
    return "Pushing to main is not allowed. Push a ticket branch and open a PR.";
  }
  if ((isPush || isCommit) && hasFlag(command, "--no-verify")) {
    return "--no-verify skips the repo's checks. Fix what the check reports instead.";
  }
  if (isCommit && /co-authored-by:\s*claude|claude-session:/i.test(command)) {
    return "Commits must not carry Co-Authored-By: Claude or Claude-Session lines. Remove them from the message.";
  }
  // A commit message may mention .env; only real file access counts.
  const withoutMessages = command.replace(COMMIT_MESSAGE_PATTERN, "");
  const envFiles = [...withoutMessages.matchAll(ENV_FILE_PATTERN)].map(
    (match) => match[0].trim(),
  );

  if (envFiles.some((file) => !file.endsWith(".env.example"))) {
    return "Do not read or touch .env files from the shell; they hold secrets. Use .env.example for the variable names.";
  }
  return null;
};
