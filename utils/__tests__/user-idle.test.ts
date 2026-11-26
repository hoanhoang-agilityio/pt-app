import { describe, expect, it, vi } from "vitest";

import {
  createActivityTracker,
  isIdleAt,
  isUserIdle,
  onUserActive,
  USER_IDLE_MS,
} from "@/utils/user-idle";

describe("isIdleAt", () => {
  it("is idle exactly at the limit, not just before", () => {
    expect(isIdleAt(0, 999, 1000)).toBe(false);
    expect(isIdleAt(0, 1000, 1000)).toBe(true);
  });
});

describe("createActivityTracker", () => {
  it("turns idle after the limit and active again on activity", () => {
    const tracker = createActivityTracker(1000, 0);

    expect(tracker.isIdle(500)).toBe(false);
    expect(tracker.isIdle(1500)).toBe(true);
    tracker.markActive(1500);
    expect(tracker.isIdle(1600)).toBe(false);
  });

  it("fires listeners once, only when activity ends an idle period", () => {
    const tracker = createActivityTracker(1000, 0);
    const listener = vi.fn();

    tracker.onActive(listener);
    tracker.markActive(500);
    expect(listener).not.toHaveBeenCalled();
    tracker.markActive(2000);
    expect(listener).toHaveBeenCalledTimes(1);
    tracker.markActive(2100);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops calling an unsubscribed listener", () => {
    const tracker = createActivityTracker(1000, 0);
    const listener = vi.fn();
    const off = tracker.onActive(listener);

    off();
    tracker.markActive(5000);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("without a window", () => {
  it("is never idle and onUserActive is a no-op", () => {
    expect(USER_IDLE_MS).toBe(300_000);
    expect(isUserIdle(Date.now() + 10 * USER_IDLE_MS)).toBe(false);
    expect(() => onUserActive(() => undefined)()).not.toThrow();
  });
});
