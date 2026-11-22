import { describe, expect, it } from "vitest";

import { validatePasswordChange } from "../password-rules";

describe("validatePasswordChange", () => {
  it("accepts a valid change", () => {
    expect(validatePasswordChange("old-pass", "new-password", "new-password", 8, 128)).toBeNull();
  });
  it("requires the current password", () => {
    expect(validatePasswordChange("", "new-password", "new-password", 8, 128)).toBe("required");
  });
  it("rejects too short and too long new passwords", () => {
    expect(validatePasswordChange("old", "short", "short", 8, 128)).toBe("tooShort");
    expect(validatePasswordChange("old", "x".repeat(129), "x".repeat(129), 8, 128)).toBe("tooShort");
  });
  it("rejects the same password", () => {
    expect(validatePasswordChange("same-password", "same-password", "same-password", 8, 128)).toBe("same");
  });
  it("rejects a mismatching repeat", () => {
    expect(validatePasswordChange("old", "new-password", "new-passwor", 8, 128)).toBe("mismatch");
  });
});
