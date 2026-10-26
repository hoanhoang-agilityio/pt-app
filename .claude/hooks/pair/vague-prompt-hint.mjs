// UserPromptSubmit hook. A short "fix it"-style prompt with no error text,
// path or detail gets a reminder to collect the facts before changing code.
// Never blocks the prompt.
import { emit, readStdin } from "./state.mjs";

const VAGUE_ASK =
  /\b(fix|debug|broken|bug|error|doesn'?t work|not working|fails?)\b|sửa|lỗi|không chạy|bị hỏng/i;
const HAS_DETAIL = /[/\\:`"'(){}[\]<>=]|\.\w{1,4}\b|\d{3,}/;

const prompt = (readStdin().prompt ?? "").trim();
const words = prompt.split(/\s+/).filter(Boolean).length;

if (
  words > 0 &&
  words <= 8 &&
  VAGUE_ASK.test(prompt) &&
  !HAS_DETAIL.test(prompt)
) {
  emit({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext:
        "The request is short and has no specifics. Before changing code, find the exact error, where it happens, how to reproduce it and the expected result: check logs, recent commits and tests yourself, then ask the user only for what is still missing.",
    },
  });
}
