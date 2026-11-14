import { describe, expect, it } from "vitest";

import {
  chatPaths,
  jumpHref,
  parseJumpId,
  parseSearchQuery,
  searchHref,
} from "@/features/chat/utils/chat-links";

describe("chatPaths", () => {
  it("has a fixed set for the trainee", () => {
    expect(chatPaths("user", 5)).toEqual({
      chat: "/messages/coach",
      info: "/messages/coach/info",
      photos: "/messages/coach/photos",
      search: "/messages/coach/search",
    });
  });

  it("has a set per trainee for the admin", () => {
    expect(chatPaths("admin", 5)).toEqual({
      chat: "/admin/users/5/messages",
      info: "/admin/users/5/messages/info",
      photos: "/admin/users/5/messages/photos",
      search: "/admin/users/5/messages/search",
    });
  });
});

describe("jumpHref / parseJumpId", () => {
  it("round-trips a message id", () => {
    const href = jumpHref("/messages/coach", 123);

    expect(href).toBe("/messages/coach?m=123");
    expect(
      parseJumpId(new URL(href, "http://x").searchParams.get("m") ?? ""),
    ).toBe(123);
  });

  it("takes the first of a repeated param and ignores junk", () => {
    expect(parseJumpId(["7", "8"])).toBe(7);
    for (const bad of [undefined, "", "0", "-1", "1e3", "abc", " 4"]) {
      expect(parseJumpId(bad)).toBeNull();
    }
  });
});

describe("jumpHref with a query / parseSearchQuery", () => {
  it("adds an encoded q and reads it back", () => {
    const href = jumpHref("/messages/coach", 7, "ăn & uống");
    const q = new URL(href, "http://x").searchParams.get("q") ?? "";

    expect(href.startsWith("/messages/coach?m=7&q=")).toBe(true);
    expect(parseSearchQuery(q)).toBe("ăn & uống");
  });

  it("builds the search href", () => {
    expect(searchHref("/messages/coach/search", "a b")).toBe(
      "/messages/coach/search?q=a+b",
    );
  });

  it("accepts only searchable queries", () => {
    expect(parseSearchQuery(" ab ")).toBe("ab");
    expect(parseSearchQuery(["xy", "zz"])).toBe("xy");
    expect(parseSearchQuery("a")).toBeNull();
    expect(parseSearchQuery("   ")).toBeNull();
    expect(parseSearchQuery(undefined)).toBeNull();
    expect(parseSearchQuery("x".repeat(101))).toBeNull();
    expect(parseSearchQuery("x".repeat(100))).toBe("x".repeat(100));
  });
});
