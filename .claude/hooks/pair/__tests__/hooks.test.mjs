// Run with: node --test .claude/hooks/pair/__tests__/hooks.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = join(dirname(fileURLToPath(import.meta.url)), "..");

const runHook = (name, input, tmp) => {
  const result = spawnSync(process.execPath, [join(scripts, name)], {
    input: JSON.stringify(input),
    env: { ...process.env, TMPDIR: tmp, TEMP: tmp, TMP: tmp },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : null;
};

const edit = (file, tmp) =>
  runHook(
    "verify-tracker.mjs",
    { session_id: "s1", tool_name: "Edit", tool_input: { file_path: file } },
    tmp,
  );
const bash = (command, tmp) =>
  runHook(
    "verify-tracker.mjs",
    { session_id: "s1", tool_name: "Bash", tool_input: { command } },
    tmp,
  );
const stop = (active, tmp) =>
  runHook(
    "stop-verify-gate.mjs",
    { session_id: "s1", stop_hook_active: active },
    tmp,
  );

test("nudges once at the third unverified code file", () => {
  const tmp = mkdtempSync(join(tmpdir(), "pair-"));
  assert.equal(edit("/r/a.ts", tmp), null);
  assert.equal(edit("/r/a.ts", tmp), null);
  assert.equal(edit("/r/b.ts", tmp), null);
  const out = edit("/r/c.ts", tmp);
  assert.match(out.hookSpecificOutput.additionalContext, /3 files changed/);
  assert.equal(edit("/r/d.ts", tmp), null);
});

test("doc edits are not tracked", () => {
  const tmp = mkdtempSync(join(tmpdir(), "pair-"));
  edit("/r/README.md", tmp);
  assert.equal(stop(false, tmp), null);
});

test("stop is blocked once after unverified edits, then allowed", () => {
  const tmp = mkdtempSync(join(tmpdir(), "pair-"));
  edit("/r/a.ts", tmp);
  assert.equal(stop(false, tmp).decision, "block");
  assert.equal(stop(true, tmp), null);
});

test("a check command clears the unverified set", () => {
  const tmp = mkdtempSync(join(tmpdir(), "pair-"));
  edit("/r/a.ts", tmp);
  bash("git status", tmp);
  assert.equal(stop(false, tmp).decision, "block");
  bash("pnpm test && pnpm lint", tmp);
  assert.equal(stop(false, tmp), null);
});

test("vague prompts get a hint, detailed ones do not", () => {
  const tmp = mkdtempSync(join(tmpdir(), "pair-"));
  const hint = (prompt) => runHook("vague-prompt-hint.mjs", { prompt }, tmp);
  assert.ok(hint("fix this").hookSpecificOutput.additionalContext);
  assert.ok(hint("sửa lỗi giúp mình").hookSpecificOutput);
  assert.equal(hint("fix the TypeError in app/page.tsx line 12"), null);
  assert.equal(hint("add a dark mode toggle"), null);
  assert.equal(hint("fix login: TypeError: cannot read 'id'"), null);
});
