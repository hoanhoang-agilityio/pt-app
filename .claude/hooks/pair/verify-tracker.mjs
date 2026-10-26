// PostToolUse hook. Edits add the file to the unverified set; a test, lint or
// typecheck command clears it. Once too many files are unverified, Claude is
// told to stop and verify before editing more. Never blocks a tool call.
import {
  emit,
  isCodeFile,
  loadUnverified,
  readStdin,
  saveUnverified,
  VERIFY_COMMAND,
} from "./state.mjs";

const THRESHOLD = Number(process.env.PAIR_VERIFY_THRESHOLD) || 3;

const input = readStdin();
const sessionId = input.session_id;

if (input.tool_name === "Bash") {
  if (VERIFY_COMMAND.test(input.tool_input?.command ?? "")) {
    saveUnverified(sessionId, []);
  }
} else {
  const filePath = input.tool_input?.file_path;
  if (isCodeFile(filePath)) {
    const unverified = loadUnverified(sessionId);
    if (!unverified.includes(filePath)) {
      unverified.push(filePath);
      saveUnverified(sessionId, unverified);
      if (unverified.length === THRESHOLD) {
        emit({
          hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: `${unverified.length} files changed since the last test, lint or typecheck run (${unverified.join(", ")}). Verify now with the project's check command before editing more files.`,
          },
        });
      }
    }
  }
}
