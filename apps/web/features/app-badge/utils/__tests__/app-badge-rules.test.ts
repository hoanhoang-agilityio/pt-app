import { describe, expect, it } from "vitest";

import {
  appBadgeAction,
  parseAppBadge,
  sumAppBadge,
} from "@/features/app-badge/utils/app-badge-rules";

const ready = {
  supported: true,
  permissionGranted: true,
  subscribed: true,
  count: 3,
};

describe("sumAppBadge", () => {
  it("adds chats, groups and notifications", () => {
    expect(sumAppBadge({ chat: 2, groups: 3, notifications: 4 })).toBe(9);
  });

  it("treats negative and non-finite values as 0", () => {
    expect(
      sumAppBadge({ chat: -5, groups: Number.NaN, notifications: 2 }),
    ).toBe(2);
  });
});

describe("parseAppBadge", () => {
  it("reads a number and ignores anything else", () => {
    expect(parseAppBadge({ appBadge: 7 })).toBe(7);
    expect(parseAppBadge({ appBadge: "7" })).toBeNull();
    expect(parseAppBadge({})).toBeNull();
    expect(parseAppBadge(null)).toBeNull();
    expect(parseAppBadge({ appBadge: Number.POSITIVE_INFINITY })).toBeNull();
  });
});

describe("appBadgeAction", () => {
  it("sets the count when everything is on", () => {
    expect(appBadgeAction(ready)).toEqual({ kind: "set", count: 3 });
  });

  it("clears at zero", () => {
    expect(appBadgeAction({ ...ready, count: 0 })).toEqual({ kind: "clear" });
  });

  it("clears when there is no push subscription", () => {
    expect(appBadgeAction({ ...ready, subscribed: false })).toEqual({
      kind: "clear",
    });
  });

  it("clears when notification permission is not granted", () => {
    expect(appBadgeAction({ ...ready, permissionGranted: false })).toEqual({
      kind: "clear",
    });
  });

  it("does nothing without the Badging API", () => {
    expect(appBadgeAction({ ...ready, supported: false })).toEqual({
      kind: "none",
    });
  });

  it("leaves the badge alone until the first count arrives", () => {
    expect(appBadgeAction({ ...ready, count: null })).toEqual({ kind: "none" });
  });
});
