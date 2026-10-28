// Pure rules for the test-file guard hook, kept separate so Vitest can cover them.

const TEST_PATH_PATTERNS = [
  /(^|\/)__tests__\//,
  /\.(test|spec)\.tsx?$/,
  /(^|\/)e2e\//,
];

// Returns the reason an edit is blocked, or null when it may run. Test files
// are only protected while fix mode is on (the marker file .claude/fix-mode).
export const findTestEditViolation = (filePath, { fixMode = false } = {}) => {
  if (!fixMode || typeof filePath !== "string") {
    return null;
  }
  const normalized = filePath.replaceAll("\\", "/");

  if (TEST_PATH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return `Fix mode is on, so test files are read-only (${normalized}). Fix the code, not the test. If the test itself is wrong, stop and ask the human, who removes .claude/fix-mode.`;
  }
  return null;
};
