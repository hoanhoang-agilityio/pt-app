import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGestureTracker,
  DOUBLE_TAP_MS,
  isDoubleTap,
  isWithinTolerance,
  LONG_PRESS_MS,
  MOVE_TOLERANCE_PX,
} from "@/features/chat/utils/gesture";

describe("isWithinTolerance", () => {
  it("accepts up to 10 px and rejects more", () => {
    expect(isWithinTolerance({ x: 0, y: 0 }, { x: 6, y: 8 })).toBe(true);
    expect(isWithinTolerance({ x: 0, y: 0 }, { x: 0, y: 11 })).toBe(false);
    expect(MOVE_TOLERANCE_PX).toBe(10);
  });
});

describe("isDoubleTap", () => {
  const first = { x: 50, y: 50, time: 1000 };

  it("needs a previous tap", () => {
    expect(isDoubleTap(null, first)).toBe(false);
  });

  it("accepts a second tap exactly 300 ms later but not 301", () => {
    expect(isDoubleTap(first, { ...first, time: 1000 + DOUBLE_TAP_MS })).toBe(
      true,
    );
    expect(
      isDoubleTap(first, { ...first, time: 1000 + DOUBLE_TAP_MS + 1 }),
    ).toBe(false);
  });

  it("rejects a second tap that landed far away", () => {
    expect(isDoubleTap(first, { x: 90, y: 50, time: 1100 })).toBe(false);
  });
});

describe("createGestureTracker", () => {
  const onDoubleTap = vi.fn();
  const onLongPress = vi.fn();
  const at = (x = 40, y = 40) => ({ x, y });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    onDoubleTap.mockReset();
    onLongPress.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const tracker = () => createGestureTracker({ onDoubleTap, onLongPress });

  it("fires a double tap for two quick taps", () => {
    const gesture = tracker();

    gesture.down(at());
    vi.advanceTimersByTime(80);
    gesture.up(at());
    vi.advanceTimersByTime(120);
    gesture.down(at());
    vi.advanceTimersByTime(60);
    gesture.up(at());

    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("does not fire when the taps are too far apart in time", () => {
    const gesture = tracker();

    gesture.down(at());
    gesture.up(at());
    vi.advanceTimersByTime(DOUBLE_TAP_MS + 50);
    gesture.down(at());
    gesture.up(at());

    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("does not count a third tap as a second double tap", () => {
    const gesture = tracker();

    for (let tap = 0; tap < 3; tap += 1) {
      gesture.down(at());
      gesture.up(at());
      vi.advanceTimersByTime(100);
    }

    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it("opens on a long press after 450 ms and ignores the release", () => {
    const gesture = tracker();

    gesture.down(at());
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    gesture.up(at());
    gesture.down(at());
    gesture.up(at());

    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("cancels the long press when the finger moves more than 10 px", () => {
    const gesture = tracker();

    gesture.down(at(40, 40));
    gesture.move(at(40, 52));
    vi.advanceTimersByTime(LONG_PRESS_MS + 100);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("keeps the long press for a small wobble", () => {
    const gesture = tracker();

    gesture.down(at(40, 40));
    gesture.move(at(43, 44));
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("treats a scroll (moved finger) as no tap", () => {
    const gesture = tracker();

    gesture.down(at(40, 40));
    gesture.move(at(40, 80));
    gesture.up(at(40, 80));
    gesture.down(at(40, 80));
    gesture.up(at(40, 80));

    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("drops everything on cancel (the browser took over to scroll)", () => {
    const gesture = tracker();

    gesture.down(at());
    gesture.cancel();
    vi.advanceTimersByTime(LONG_PRESS_MS + 100);
    gesture.up(at());

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  describe("single tap", () => {
    const onSingleTap = vi.fn();
    const withSingle = () =>
      createGestureTracker({ onDoubleTap, onLongPress, onSingleTap });
    const tap = (gesture: ReturnType<typeof withSingle>, x = 40) => {
      gesture.down(at(x));
      vi.advanceTimersByTime(60);
      gesture.up(at(x));
    };

    beforeEach(() => onSingleTap.mockReset());

    it("fires once, only after the double-tap window", () => {
      const gesture = withSingle();

      tap(gesture);
      vi.advanceTimersByTime(DOUBLE_TAP_MS - 1);
      expect(onSingleTap).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onSingleTap).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1000);
      expect(onSingleTap).toHaveBeenCalledTimes(1);
    });

    it("never fires for a double tap", () => {
      const gesture = withSingle();

      tap(gesture);
      vi.advanceTimersByTime(100);
      tap(gesture);
      vi.advanceTimersByTime(1000);

      expect(onDoubleTap).toHaveBeenCalledTimes(1);
      expect(onSingleTap).not.toHaveBeenCalled();
    });

    it("never fires for a long press or a scroll", () => {
      const gesture = withSingle();

      gesture.down(at());
      vi.advanceTimersByTime(LONG_PRESS_MS + 10);
      gesture.up(at());
      gesture.down(at());
      gesture.move(at(40, 80));
      gesture.up(at(40, 80));
      vi.advanceTimersByTime(1000);

      expect(onLongPress).toHaveBeenCalledTimes(1);
      expect(onSingleTap).not.toHaveBeenCalled();
    });

    it("survives the pointerleave cancel that follows a touch release, but not dispose", () => {
      const gesture = withSingle();

      tap(gesture);
      gesture.cancel();
      vi.advanceTimersByTime(DOUBLE_TAP_MS);
      expect(onSingleTap).toHaveBeenCalledTimes(1);

      tap(gesture);
      gesture.dispose();
      vi.advanceTimersByTime(DOUBLE_TAP_MS * 2);
      expect(onSingleTap).toHaveBeenCalledTimes(1);
    });

    it("is optional", () => {
      const gesture = tracker();

      tap(gesture);
      expect(() => vi.advanceTimersByTime(DOUBLE_TAP_MS)).not.toThrow();
    });
  });
});

describe("createGestureTracker swipe to reply", () => {
  const onDoubleTap = vi.fn();
  const onLongPress = vi.fn();
  const onSingleTap = vi.fn();
  const onSwipeReply = vi.fn();
  const onSwipeMove = vi.fn();
  const onSwipeThreshold = vi.fn();
  const onSwipeEnd = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    for (const fn of [
      onDoubleTap,
      onLongPress,
      onSingleTap,
      onSwipeReply,
      onSwipeMove,
      onSwipeThreshold,
      onSwipeEnd,
    ]) {
      fn.mockReset();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const tracker = (withSwipe = true) =>
    createGestureTracker({
      onDoubleTap,
      onLongPress,
      onSingleTap,
      ...(withSwipe
        ? { onSwipeReply, onSwipeMove, onSwipeThreshold, onSwipeEnd }
        : {}),
    });

  it("replies when released past the threshold", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 });
    gesture.move({ x: 130, y: 204 });
    gesture.move({ x: 170, y: 205 });
    gesture.up({ x: 170, y: 205 });

    expect(onSwipeReply).toHaveBeenCalledTimes(1);
    expect(onSwipeMove).toHaveBeenCalledWith(30);
    expect(onSwipeMove).toHaveBeenCalledWith(64 + 6 * 0.35);
    // The last report is the spring back to 0.
    expect(onSwipeMove).toHaveBeenLastCalledWith(0);
    expect(onSwipeEnd).toHaveBeenCalledTimes(1);
  });

  it("springs back without replying when released short of the threshold", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 });
    gesture.move({ x: 150, y: 200 });
    gesture.up({ x: 150, y: 200 });

    expect(onSwipeReply).not.toHaveBeenCalled();
    expect(onSwipeEnd).toHaveBeenCalledTimes(1);
  });

  it("ticks once on crossing the threshold, not on every move", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 });
    gesture.move({ x: 140, y: 200 });
    expect(onSwipeThreshold).not.toHaveBeenCalled();
    gesture.move({ x: 165, y: 200 });
    gesture.move({ x: 180, y: 200 });
    gesture.move({ x: 190, y: 200 });

    expect(onSwipeThreshold).toHaveBeenCalledTimes(1);
  });

  it("replies on release only if the finger is still past the threshold", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 });
    gesture.move({ x: 180, y: 200 });
    gesture.move({ x: 120, y: 200 });
    gesture.up({ x: 120, y: 200 });

    expect(onSwipeReply).not.toHaveBeenCalled();
  });

  it("cancels the long press and never counts as a tap", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 });
    gesture.move({ x: 125, y: 200 });
    vi.advanceTimersByTime(LONG_PRESS_MS + 100);
    gesture.up({ x: 125, y: 200 });
    vi.advanceTimersByTime(DOUBLE_TAP_MS * 2);

    expect(onLongPress).not.toHaveBeenCalled();
    expect(onSingleTap).not.toHaveBeenCalled();
    expect(onDoubleTap).not.toHaveBeenCalled();
    expect(gesture.isSwiping()).toBe(false);
  });

  it("drops a pending tap when a swipe starts inside its double-tap window", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 });
    gesture.up({ x: 100, y: 200 });
    vi.advanceTimersByTime(100);
    gesture.down({ x: 100, y: 200 });
    gesture.move({ x: 160, y: 200 });
    gesture.up({ x: 160, y: 200 });
    vi.advanceTimersByTime(DOUBLE_TAP_MS * 2);

    expect(onDoubleTap).not.toHaveBeenCalled();
    expect(onSingleTap).not.toHaveBeenCalled();
  });

  it("keeps scrolling behaviour for a vertical move", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 });
    gesture.move({ x: 104, y: 240 });
    gesture.move({ x: 170, y: 245 });
    gesture.up({ x: 170, y: 245 });
    vi.advanceTimersByTime(LONG_PRESS_MS + DOUBLE_TAP_MS);

    expect(onSwipeReply).not.toHaveBeenCalled();
    expect(onSwipeMove).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onSingleTap).not.toHaveBeenCalled();
  });

  it("ignores a leftward drag", () => {
    const gesture = tracker();

    gesture.down({ x: 200, y: 200 });
    gesture.move({ x: 150, y: 200 });
    gesture.up({ x: 150, y: 200 });

    expect(onSwipeReply).not.toHaveBeenCalled();
    expect(gesture.isSwiping()).toBe(false);
  });

  it("ignores a press within 20 px of the left edge", () => {
    const gesture = tracker();

    gesture.down({ x: 19, y: 200 });
    gesture.move({ x: 120, y: 200 });
    gesture.up({ x: 120, y: 200 });
    expect(onSwipeReply).not.toHaveBeenCalled();

    gesture.down({ x: 20, y: 200 });
    gesture.move({ x: 120, y: 200 });
    gesture.up({ x: 120, y: 200 });
    expect(onSwipeReply).toHaveBeenCalledTimes(1);
  });

  it("does not swipe when the press says it cannot (a mouse)", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 }, { canSwipe: false });
    gesture.move({ x: 200, y: 200 });
    gesture.up({ x: 200, y: 200 });

    expect(onSwipeReply).not.toHaveBeenCalled();
  });

  it("does not swipe without an onSwipeReply handler", () => {
    const gesture = tracker(false);

    gesture.down({ x: 100, y: 200 });
    gesture.move({ x: 200, y: 200 });
    gesture.up({ x: 200, y: 200 });

    expect(onSwipeReply).not.toHaveBeenCalled();
    expect(gesture.isSwiping()).toBe(false);
  });

  it("does not start a swipe after the long press fired", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    gesture.move({ x: 200, y: 200 });
    gesture.up({ x: 200, y: 200 });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onSwipeReply).not.toHaveBeenCalled();
  });

  it("ends the swipe without replying when the browser cancels it", () => {
    const gesture = tracker();

    gesture.down({ x: 100, y: 200 });
    gesture.move({ x: 190, y: 200 });
    gesture.cancel();

    expect(onSwipeReply).not.toHaveBeenCalled();
    expect(onSwipeEnd).toHaveBeenCalledTimes(1);
    expect(gesture.isSwiping()).toBe(false);
  });

  it("skips the long press timer when there is no long-press handler", () => {
    const gesture = createGestureTracker({ onSwipeReply });

    gesture.down({ x: 100, y: 200 });
    expect(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2)).not.toThrow();
    gesture.up({ x: 100, y: 200 });
    expect(onSwipeReply).not.toHaveBeenCalled();
  });
});
