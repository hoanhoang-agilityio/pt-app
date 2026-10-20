// PostToolUse hook for Edit/Write: runs the repo's own JS/TS tooling on the
// touched file so diffs stay clean. ESLint --fix first (import order, braces),
// then Prettier for layout. Never blocks; files a tool does not handle are
// skipped, and what --fix cannot fix is left for `npm run lint`.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const ESLINT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const filePath = input.tool_input?.file_path;
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const bin = (...parts) => join(projectDir, "node_modules", ...parts);

const run = (script, args) => {
  if (existsSync(script)) {
    spawnSync(process.execPath, [script, ...args, filePath], {
      cwd: projectDir,
      stdio: ["ignore", "ignore", "ignore"],
    });
  }
};

if (filePath && existsSync(filePath)) {
  if (ESLINT_EXTENSIONS.includes(extname(filePath))) {
    run(bin("eslint", "bin", "eslint.js"), ["--fix", "--no-warn-ignored"]);
  }
  run(bin("prettier", "bin", "prettier.cjs"), [
    "--write",
    "--ignore-unknown",
    "--log-level",
    "silent",
  ]);
}
