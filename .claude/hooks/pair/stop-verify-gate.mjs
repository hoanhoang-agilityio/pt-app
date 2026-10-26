// Stop hook. If code files were edited after the last check run, block the
// stop once and ask Claude to verify or say why it cannot. The second stop in
// a row (stop_hook_active) always passes, so this never loops.
import { emit, loadUnverified, readStdin } from "./state.mjs";

const input = readStdin();
const unverified = loadUnverified(input.session_id);

if (!input.stop_hook_active && unverified.length > 0) {
  emit({
    decision: "block",
    reason: `These files changed after the last test, lint or typecheck run: ${unverified.join(", ")}. Run the project's checks and report the result, or state plainly why they cannot be run, before finishing.`,
  });
}
