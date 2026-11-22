import { describe, expect, it } from "vitest";

import { appendIds, resultNav } from "@/features/chat/utils/search-result-nav";

// Newest first, like the search route returns them.
const IDS = [30, 20, 10];

describe("resultNav", () => {
  it("has both neighbours in the middle", () => {
    expect(resultNav(IDS, 20, false)).toEqual({
      position: 2,
      total: 3,
      olderId: 10,
      newerId: 30,
      needsOlderPage: false,
    });
  });

  it("has no newer result at the first one", () => {
    const nav = resultNav(IDS, 30, false);

    expect(nav.newerId).toBeNull();
    expect(nav.olderId).toBe(20);
  });

  it("has no older result at the last one unless more pages exist", () => {
    expect(resultNav(IDS, 10, false)).toMatchObject({
      olderId: null,
      needsOlderPage: false,
    });
    expect(resultNav(IDS, 10, true)).toMatchObject({
      olderId: null,
      needsOlderPage: true,
    });
  });

  it("does not guess when the open message is not a result", () => {
    expect(resultNav(IDS, 99, true)).toEqual({
      position: null,
      total: 3,
      olderId: null,
      newerId: null,
      needsOlderPage: false,
    });
    expect(resultNav(IDS, null, true).position).toBeNull();
  });
});

describe("appendIds", () => {
  it("keeps the order and drops repeats", () => {
    expect(appendIds([3, 2], [2, 1])).toEqual([3, 2, 1]);
  });
});
