// PreToolUse hook for Edit|MultiEdit|Write: while .claude/fix-mode exists,
// blocks edits to test files so a failing test cannot be weakened to get green
// (exit code 2 sends stderr back to Claude).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { findTestEditViolation } from "./test-guard-rules.mjs";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const filePath = input.tool_input?.file_path ?? "";
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const reason = findTestEditViolation(filePath, {
  fixMode: existsSync(join(projectDir, ".claude", "fix-mode")),
});

if (reason) {
  process.stderr.write(`Blocked by .claude/hooks/test-guard.mjs: ${reason}\n`);
  process.exit(2);
}
