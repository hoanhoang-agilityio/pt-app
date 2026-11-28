import { describe, expect, it } from "vitest";

import {
  decideSwipeAxis,
  isPastThreshold,
  isReplyKey,
  SWIPE_EDGE_PX,
  SWIPE_LOCK_PX,
  SWIPE_MAX_PX,
  SWIPE_REPLY_THRESHOLD_PX,
  swipeIconProgress,
  swipeOffset,
} from "@/features/chat/utils/swipe-reply";

describe("swipe constants", () => {
  it("keeps the agreed numbers", () => {
    expect(SWIPE_REPLY_THRESHOLD_PX).toBe(64);
    expect(SWIPE_MAX_PX).toBe(96);
    expect(SWIPE_LOCK_PX).toBe(10);
    expect(SWIPE_EDGE_PX).toBe(20);
  });
});

describe("decideSwipeAxis", () => {
  it("stays undecided up to 10 px", () => {
    expect(decideSwipeAxis(6, 8)).toBe("pending");
    expect(decideSwipeAxis(10, 0)).toBe("pending");
  });

  it("locks a rightward, mostly horizontal move", () => {
    expect(decideSwipeAxis(11, 0)).toBe("swipe");
    expect(decideSwipeAxis(20, 12)).toBe("swipe");
  });

  it("gives up on a vertical move", () => {
    expect(decideSwipeAxis(3, 14)).toBe("abandon");
    expect(decideSwipeAxis(12, -12)).toBe("abandon");
  });

  it("gives up on a leftward move", () => {
    expect(decideSwipeAxis(-30, 2)).toBe("abandon");
  });
});

describe("swipeOffset", () => {
  it("is none for a leftward or zero drag", () => {
    expect(swipeOffset(-40)).toBe(0);
    expect(swipeOffset(0)).toBe(0);
  });

  it("follows the finger one to one up to the threshold", () => {
    expect(swipeOffset(30)).toBe(30);
    expect(swipeOffset(64)).toBe(64);
  });

  it("damps beyond the threshold", () => {
    // 64 + (100 - 64) * 0.35
    expect(swipeOffset(100)).toBeCloseTo(76.6, 5);
    expect(swipeOffset(65)).toBeCloseTo(64.35, 5);
  });

  it("never passes the maximum", () => {
    expect(swipeOffset(1000)).toBe(96);
  });
});

describe("isPastThreshold", () => {
  it("is true from 64 px, not before", () => {
    expect(isPastThreshold(63.9)).toBe(false);
    expect(isPastThreshold(64)).toBe(true);
    expect(isPastThreshold(swipeOffset(200))).toBe(true);
  });
});

describe("swipeIconProgress", () => {
  it("is hidden until 24 px and full at the threshold", () => {
    expect(swipeIconProgress(24)).toBe(0);
    expect(swipeIconProgress(44)).toBe(0.5);
    expect(swipeIconProgress(64)).toBe(1);
    expect(swipeIconProgress(96)).toBe(1);
  });
});

describe("isReplyKey", () => {
  const plain = { ctrlKey: false, metaKey: false, altKey: false };

  it("accepts r and R without a modifier", () => {
    expect(isReplyKey({ ...plain, key: "r" })).toBe(true);
    expect(isReplyKey({ ...plain, key: "R" })).toBe(true);
  });

  it("ignores other keys and shortcuts like Ctrl+R", () => {
    expect(isReplyKey({ ...plain, key: "e" })).toBe(false);
    expect(isReplyKey({ ...plain, key: "r", ctrlKey: true })).toBe(false);
    expect(isReplyKey({ ...plain, key: "r", metaKey: true })).toBe(false);
  });
});
