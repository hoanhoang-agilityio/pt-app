import { describe, expect, it } from "vitest";

import {
  isTypingActive,
  isTypingFromPeer,
  shouldSendTyping,
  TYPING_EXPIRY_MS,
  TYPING_THROTTLE_MS,
} from "@/features/chat/utils/typing-rules";

describe("typing constants", () => {
  it("keeps expiry longer than the throttle so typing does not flicker", () => {
    expect(TYPING_THROTTLE_MS).toBe(2500);
    expect(TYPING_EXPIRY_MS).toBe(5000);
    expect(TYPING_EXPIRY_MS).toBeGreaterThan(TYPING_THROTTLE_MS);
  });
});

describe("shouldSendTyping", () => {
  it("sends the first time", () => {
    expect(shouldSendTyping(null, 1000)).toBe(true);
  });

  it("holds back inside the throttle window", () => {
    expect(shouldSendTyping(1000, 1000)).toBe(false);
    expect(shouldSendTyping(1000, 1000 + TYPING_THROTTLE_MS - 1)).toBe(false);
  });

  it("sends again once the interval has passed", () => {
    expect(shouldSendTyping(1000, 1000 + TYPING_THROTTLE_MS)).toBe(true);
  });

  it("sends when the clock moved backwards", () => {
    expect(shouldSendTyping(5000, 1000)).toBe(true);
  });
});

describe("isTypingActive", () => {
  it("is inactive before any event", () => {
    expect(isTypingActive(null, 1000)).toBe(false);
  });

  it("is active until the expiry", () => {
    expect(isTypingActive(1000, 1000)).toBe(true);
    expect(isTypingActive(1000, 1000 + TYPING_EXPIRY_MS - 1)).toBe(true);
  });

  it("expires exactly at the expiry", () => {
    expect(isTypingActive(1000, 1000 + TYPING_EXPIRY_MS)).toBe(false);
  });

  it("ignores an event stamped in the future", () => {
    expect(isTypingActive(5000, 1000)).toBe(false);
  });
});

describe("isTypingFromPeer", () => {
  it("lets a trainee see any PT, not another trainee or themselves", () => {
    expect(isTypingFromPeer("admin:1", "user", "user:7", 7)).toBe(true);
    expect(isTypingFromPeer("admin:9", "user", "user:7", 7)).toBe(true);
    expect(isTypingFromPeer("user:8", "user", "user:7", 7)).toBe(false);
    expect(isTypingFromPeer("user:7", "user", "user:7", 7)).toBe(false);
  });

  it("lets a PT see only the trainee of this conversation", () => {
    expect(isTypingFromPeer("user:7", "admin", "admin:1", 7)).toBe(true);
    expect(isTypingFromPeer("user:8", "admin", "admin:1", 7)).toBe(false);
  });

  it("ignores another PT and our own echo on the PT side", () => {
    expect(isTypingFromPeer("admin:2", "admin", "admin:1", 7)).toBe(false);
    expect(isTypingFromPeer("admin:1", "admin", "admin:1", 7)).toBe(false);
  });

  it("ignores messages without a client id", () => {
    expect(isTypingFromPeer(undefined, "user", "user:7", 7)).toBe(false);
    expect(isTypingFromPeer(null, "admin", "admin:1", 7)).toBe(false);
    expect(isTypingFromPeer("", "admin", null, 7)).toBe(false);
  });
});
