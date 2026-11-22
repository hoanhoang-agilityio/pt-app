import { describe, expect, it } from "vitest";

import { parseAppBadge } from "../badge";

describe("parseAppBadge", () => {
  it("reads the integer badge", () => {
    expect(parseAppBadge({ count: 3, appBadge: 7 })).toBe(7);
    expect(parseAppBadge({ appBadge: 0 })).toBe(0);
  });

  it("is null when the API does not send it", () => {
    expect(parseAppBadge({ count: 3 })).toBeNull();
    expect(parseAppBadge(undefined)).toBeNull();
    expect(parseAppBadge({ appBadge: "4" })).toBeNull();
    expect(parseAppBadge({ appBadge: Number.NaN })).toBeNull();
  });

  it("never goes negative or fractional", () => {
    expect(parseAppBadge({ appBadge: -2 })).toBe(0);
    expect(parseAppBadge({ appBadge: 2.9 })).toBe(2);
  });
});
