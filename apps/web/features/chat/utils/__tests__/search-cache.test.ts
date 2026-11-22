import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSearchCache,
  readSearchCache,
  searchCacheKey,
  writeSearchCache,
} from "@/features/chat/utils/search-cache";

describe("search cache", () => {
  beforeEach(() => {
    clearSearchCache();
  });

  it("keeps two viewers apart for the same endpoint and query", () => {
    const mine = searchCacheKey("user:1", "/api/chat/search", "squat");
    const other = searchCacheKey("user:2", "/api/chat/search", "squat");

    writeSearchCache(mine, { ids: [3, 2], nextCursor: null });
    expect(readSearchCache(other)).toBeNull();
    expect(readSearchCache(mine)).toEqual({ ids: [3, 2], nextCursor: null });
  });

  it("is empty after a clear", () => {
    const key = searchCacheKey("user:1", "/api/chat/search", "squat");

    writeSearchCache(key, { ids: [1], nextCursor: 1 });
    clearSearchCache();
    expect(readSearchCache(key)).toBeNull();
  });
});
