import { describe, expect, it } from "vitest";

import {
  generatePassword,
  RANDOM_PASSWORD_LENGTH,
} from "@/features/pts/utils/random-password";

describe("generatePassword", () => {
  it("returns 12 characters by default, without look-alikes", () => {
    const password = generatePassword();

    expect(password).toHaveLength(RANDOM_PASSWORD_LENGTH);
    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/);
  });

  it("differs between calls", () => {
    expect(generatePassword()).not.toBe(generatePassword());
  });
});
