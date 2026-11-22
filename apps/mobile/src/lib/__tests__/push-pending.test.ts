import { describe, expect, it } from "vitest";

import {
  addPendingToken,
  isPushPlatform,
  parsePendingTokens,
  removePendingToken,
} from "../push-pending";
import { createHandledTracker } from "../push-routes";

describe("pending push tokens", () => {
  it("parses stored JSON defensively", () => {
    expect(parsePendingTokens(null)).toEqual([]);
    expect(parsePendingTokens("not json")).toEqual([]);
    expect(parsePendingTokens('{"a":1}')).toEqual([]);
    expect(parsePendingTokens('["a","a","",1,"b"]')).toEqual(["a", "b"]);
  });

  it("adds without duplicates and removes", () => {
    expect(addPendingToken(["a"], "b")).toEqual(["a", "b"]);
    expect(addPendingToken(["a"], "a")).toEqual(["a"]);
    expect(removePendingToken(["a", "b"], "a")).toEqual(["b"]);
    expect(removePendingToken(["a"], "z")).toEqual(["a"]);
  });

  it("only registers on ios and android", () => {
    expect(isPushPlatform("ios")).toBe(true);
    expect(isPushPlatform("android")).toBe(true);
    expect(isPushPlatform("web")).toBe(false);
    expect(isPushPlatform("windows")).toBe(false);
  });
});

describe("createHandledTracker", () => {
  it("accepts a notification id once", () => {
    const handle = createHandledTracker();

    expect(handle("n1")).toBe(true);
    expect(handle("n1")).toBe(false);
    expect(handle("n2")).toBe(true);
  });

  it("ignores a missing id", () => {
    const handle = createHandledTracker();

    expect(handle(undefined)).toBe(false);
    expect(handle("")).toBe(false);
  });
});
