// Shared state for the verify hooks: the set of code files edited since the
// last test/lint/typecheck run, kept per session in the OS temp folder.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

const STATE_DIR = join(tmpdir(), "ai-pair-workflow");

// Edits to these do not need a test run before stopping.
const DOC_EXTENSIONS = [".md", ".mdx", ".txt", ".rst", ".adoc"];

export const VERIFY_COMMAND =
  /\b(?:(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?(?:test|typecheck|lint|check|verify)\b|vitest|jest|pytest|playwright\s+test|go\s+test|cargo\s+(?:test|check)|tsc\b|mvn\s+test|gradle\w*\s+test|dotnet\s+test|rspec|phpunit)/;

export const readStdin = () => {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
};

const statePath = (sessionId) =>
  join(
    STATE_DIR,
    `${String(sessionId || "default").replace(/[^\w-]/g, "_")}.json`,
  );

export const loadUnverified = (sessionId) => {
  try {
    return (
      JSON.parse(readFileSync(statePath(sessionId), "utf8")).unverified ?? []
    );
  } catch {
    return [];
  }
};

export const saveUnverified = (sessionId, unverified) => {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(sessionId), JSON.stringify({ unverified }));
};

export const isCodeFile = (filePath) =>
  Boolean(filePath) &&
  !DOC_EXTENSIONS.includes(extname(filePath).toLowerCase());

export const emit = (payload) => process.stdout.write(JSON.stringify(payload));
