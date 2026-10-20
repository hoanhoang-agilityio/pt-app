// PreToolUse hook for Bash: blocks commands the team never runs and tells
// Claude why (exit code 2 sends stderr back to Claude).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { findViolation } from "./rules.mjs";

const readCurrentBranch = () => {
  try {
    return execSync("git branch --show-current", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const command = input.tool_input?.command ?? "";
const reason = findViolation(command, readCurrentBranch());

if (reason) {
  process.stderr.write(
    `Blocked by .claude/hooks/block-forbidden.mjs: ${reason}\n`,
  );
  process.exit(2);
}
