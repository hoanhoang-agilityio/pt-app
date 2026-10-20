// PostToolUse hook for Edit/Write: formats the touched file with the repo's
// Prettier so diffs stay clean. Never blocks; unsupported files are skipped.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const filePath = input.tool_input?.file_path;
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const prettier = join(
  projectDir,
  "node_modules",
  "prettier",
  "bin",
  "prettier.cjs",
);

if (filePath && existsSync(filePath) && existsSync(prettier)) {
  spawnSync(
    process.execPath,
    [prettier, "--write", "--ignore-unknown", "--log-level", "warn", filePath],
    {
      cwd: projectDir,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
}
