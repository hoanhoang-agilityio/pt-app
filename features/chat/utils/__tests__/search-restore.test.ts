import { describe, expect, it } from "vitest";

import {
  extraPagesToLoad,
  MAX_RESTORE_PAGES,
  parseSearchRestore,
  searchRestoreKey,
  serializeSearchRestore,
} from "@/features/chat/utils/search-restore";

describe("searchRestoreKey", () => {
  it("is per endpoint and trimmed query", () => {
    expect(searchRestoreKey("/api/chat/search", " abc ")).toBe(
      "chat-search:/api/chat/search:abc",
    );
    expect(searchRestoreKey("/api/admin/chat/1/search", "abc")).not.toBe(
      searchRestoreKey("/api/admin/chat/2/search", "abc"),
    );
  });
});

describe("parseSearchRestore", () => {
  it("round-trips a value", () => {
    expect(
      parseSearchRestore(serializeSearchRestore({ pages: 3, messageId: 42 })),
    ).toEqual({ pages: 3, messageId: 42 });
  });

  it("rejects missing, broken and out-of-range values", () => {
    const bad = [
      null,
      undefined,
      "",
      "nope",
      "null",
      "[]",
      '{"pages":0,"messageId":1}',
      '{"pages":1,"messageId":0}',
      '{"pages":"2","messageId":1}',
      '{"pages":1.5,"messageId":1}',
      `{"pages":${MAX_RESTORE_PAGES + 1},"messageId":1}`,
      '{"pages":1}',
    ];

    for (const raw of bad) {
      expect(parseSearchRestore(raw)).toBeNull();
    }
  });
});

describe("extraPagesToLoad", () => {
  const restore = { pages: 3, messageId: 9 };

  it("loads the pages that were open beyond the first", () => {
    expect(extraPagesToLoad(restore, 1, 50)).toBe(2);
    expect(extraPagesToLoad(restore, 2, 50)).toBe(1);
  });

  it("stops when done, when no cursor is left or nothing is stored", () => {
    expect(extraPagesToLoad(restore, 3, 50)).toBe(0);
    expect(extraPagesToLoad(restore, 1, null)).toBe(0);
    expect(extraPagesToLoad(null, 1, 50)).toBe(0);
  });
});
