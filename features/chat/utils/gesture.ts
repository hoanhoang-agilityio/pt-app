// Touch gestures on a chat bubble, as pure timing rules (no React, no DOM):
// double-tap toggles my heart, a long press opens the actions sheet, a single
// tap (optional) fires once the double-tap window has passed without a second
// tap, a finger that moves is a scroll, never a tap, and a finger that moves
// right (when `onSwipeReply` is set) is a swipe to reply, never a tap.

import {
  decideSwipeAxis,
  isPastThreshold,
  SWIPE_EDGE_PX,
  swipeOffset,
} from "@/features/chat/utils/swipe-reply";

export const DOUBLE_TAP_MS = 300;
export const LONG_PRESS_MS = 450;
export const MOVE_TOLERANCE_PX = 10;

export interface Point {
  x: number;
  y: number;
}

export interface TimedPoint extends Point {
  time: number;
}

// Up to the tolerance counts as "did not move".
export const isWithinTolerance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y) <= MOVE_TOLERANCE_PX;

// Two taps within 300 ms of each other (finger lifted both times) that land
// close together.
export const isDoubleTap = (previous: TimedPoint | null, next: TimedPoint) =>
  previous !== null &&
  next.time - previous.time <= DOUBLE_TAP_MS &&
  isWithinTolerance(previous, next);

export interface GestureHandlers {
  // Without them the gesture is not offered (a bubble with no hearts or
  // actions sheet, like a friend chat).
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  // Only after DOUBLE_TAP_MS with no second tap, so it never fires on the
  // first tap of a double-tap.
  onSingleTap?: () => void;
  // Set = left-to-right swipes are recognised. Fires on release past the
  // threshold.
  onSwipeReply?: () => void;
  // The row's drawn offset in px while a swipe is locked (0 when it ends).
  onSwipeMove?: (offset: number) => void;
  // The finger crossed the reply threshold (the haptic tick).
  onSwipeThreshold?: () => void;
  // The swipe is over, replied or not (the row springs back).
  onSwipeEnd?: () => void;
}

export interface DownOptions {
  // False for a mouse: dragging with a mouse never replies.
  canSwipe?: boolean;
}

export interface GestureClock {
  now: () => number;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

const SYSTEM_CLOCK: GestureClock = {
  now: () => Date.now(),
  setTimer: (callback, ms) => setTimeout(callback, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

// One recogniser per bubble. Feed it pointer down / move / up / cancel.
export const createGestureTracker = (
  initialHandlers: GestureHandlers,
  clock: GestureClock = SYSTEM_CLOCK,
) => {
  let handlers = initialHandlers;
  let start: Point | null = null;
  let timer: unknown = null;
  let didLongPress = false;
  let lastTap: TimedPoint | null = null;
  let singleTapTimer: unknown = null;
  // This press may become a swipe (not at the screen edge, not a mouse).
  let maySwipe = false;
  let isSwiping = false;
  let isPast = false;

  const clearSingleTap = () => {
    if (singleTapTimer !== null) {
      clock.clearTimer(singleTapTimer);
      singleTapTimer = null;
    }
  };

  const clearPress = () => {
    if (timer !== null) {
      clock.clearTimer(timer);
      timer = null;
    }
  };

  const endSwipe = () => {
    isSwiping = false;
    isPast = false;
    handlers.onSwipeMove?.(0);
    handlers.onSwipeEnd?.();
  };

  // A finger that drifts is scrolling (drop the long press and the tap),
  // unless it went right: then it is a swipe to reply.
  const move = (point: Point) => {
    if (start === null) {
      return;
    }
    if (isSwiping) {
      const offset = swipeOffset(point.x - start.x);
      const past = isPastThreshold(offset);

      handlers.onSwipeMove?.(offset);
      if (past && !isPast) {
        handlers.onSwipeThreshold?.();
      }
      isPast = past;
      return;
    }
    if (isWithinTolerance(start, point)) {
      return;
    }
    clearPress();
    if (
      maySwipe &&
      !didLongPress &&
      handlers.onSwipeReply &&
      decideSwipeAxis(point.x - start.x, point.y - start.y) === "swipe"
    ) {
      // A swipe is neither a tap nor half of a double-tap.
      lastTap = null;
      clearSingleTap();
      isSwiping = true;
      isPast = false;
      move(point);
      return;
    }
    start = null;
    lastTap = null;
  };

  return {
    // True from the moment the finger locked onto a swipe until it lifts.
    isSwiping: () => isSwiping,
    // Swap the callbacks without losing a pending tap.
    setHandlers(next: GestureHandlers) {
      handlers = next;
    },
    down(point: Point, { canSwipe = true }: DownOptions = {}) {
      clearPress();
      if (isSwiping) {
        endSwipe();
      }
      start = point;
      didLongPress = false;
      maySwipe = canSwipe && point.x >= SWIPE_EDGE_PX;
      if (!handlers.onLongPress) {
        return;
      }
      timer = clock.setTimer(() => {
        timer = null;
        didLongPress = true;
        lastTap = null;
        clearSingleTap();
        handlers.onLongPress?.();
      }, LONG_PRESS_MS);
    },
    move,
    up(point: Point) {
      clearPress();
      if (isSwiping && start !== null) {
        const committed = isPastThreshold(swipeOffset(point.x - start.x));

        start = null;
        endSwipe();
        if (committed) {
          handlers.onSwipeReply?.();
        }
        return;
      }
      const wasTap = start !== null && !didLongPress;

      start = null;
      if (!wasTap) {
        return;
      }
      const tap: TimedPoint = { ...point, time: clock.now() };

      clearSingleTap();
      if (isDoubleTap(lastTap, tap)) {
        lastTap = null;
        handlers.onDoubleTap?.();
      } else {
        lastTap = tap;
        singleTapTimer = clock.setTimer(() => {
          singleTapTimer = null;
          handlers.onSingleTap?.();
        }, DOUBLE_TAP_MS);
      }
    },
    // The browser took the touch over: the press and tap in progress are
    // dropped. A finished tap still waiting for its double-tap window stays
    // (pointerleave follows every touch release).
    cancel() {
      clearPress();
      start = null;
      if (isSwiping) {
        endSwipe();
      }
    },
    // Unmount: nothing may fire any more.
    dispose() {
      clearPress();
      clearSingleTap();
      start = null;
      isSwiping = false;
    },
  };
};
