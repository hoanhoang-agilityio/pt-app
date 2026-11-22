import { describe, expect, it } from "vitest";

import { needsMoreToFill, shouldLoadOlder } from "@/utils/load-older-rules";

const READY = {
  hasMore: true,
  isLoading: false,
  hasError: false,
  isSentinelVisible: true,
  isInitialised: true,
};

describe("shouldLoadOlder", () => {
  it("loads when everything allows it", () => {
    expect(shouldLoadOlder(READY)).toBe(true);
  });

  it("does not load when there is nothing more", () => {
    expect(shouldLoadOlder({ ...READY, hasMore: false })).toBe(false);
  });

  it("does not load while a request is in flight", () => {
    expect(shouldLoadOlder({ ...READY, isLoading: true })).toBe(false);
  });

  it("stops after an error until retry", () => {
    expect(shouldLoadOlder({ ...READY, hasError: true })).toBe(false);
  });

  it("does not load while the sentinel is out of view", () => {
    expect(shouldLoadOlder({ ...READY, isSentinelVisible: false })).toBe(false);
  });

  it("does not load before the initial scroll to the bottom", () => {
    expect(shouldLoadOlder({ ...READY, isInitialised: false })).toBe(false);
  });
});

describe("needsMoreToFill", () => {
  it("is true when the content is shorter than the container", () => {
    expect(needsMoreToFill({ scrollHeight: 300, clientHeight: 600 })).toBe(
      true,
    );
  });

  it("is true when the content exactly fits (nothing to scroll)", () => {
    expect(needsMoreToFill({ scrollHeight: 600, clientHeight: 600 })).toBe(
      true,
    );
  });

  it("is false when the content overflows", () => {
    expect(needsMoreToFill({ scrollHeight: 601, clientHeight: 600 })).toBe(
      false,
    );
  });
});
