// Swipe a bubble left-to-right to reply (Messenger / Zalo style), as pure
// rules: when the finger commits to a swipe, how far the row follows it, and
// when releasing counts as a reply. No React, no DOM.

// Dragging this far (after the rubber band) and letting go replies.
export const SWIPE_REPLY_THRESHOLD_PX = 64;
// The row never moves further than this.
export const SWIPE_MAX_PX = 96;
// Up to this much movement the direction is still undecided.
export const SWIPE_LOCK_PX = 10;
// A press this close to the left edge of the viewport is the browser's
// "back" gesture, never a reply.
export const SWIPE_EDGE_PX = 20;
// Past the threshold the row follows the finger at this fraction.
const DAMPING = 0.35;
// The reply icon starts to appear at this offset.
export const SWIPE_ICON_START_PX = 24;

export type SwipeDecision = "pending" | "swipe" | "abandon";

// Once the finger left the lock radius: a swipe only if it went right and
// more sideways than up or down; anything else (a scroll, a leftward drag)
// gives the gesture up.
export const decideSwipeAxis = (dx: number, dy: number): SwipeDecision => {
  if (Math.hypot(dx, dy) <= SWIPE_LOCK_PX) {
    return "pending";
  }
  return dx > 0 && Math.abs(dx) > Math.abs(dy) ? "swipe" : "abandon";
};

// How far the row is drawn for a finger that moved `dx` sideways: one to one
// up to the threshold, damped beyond it, capped at the maximum, and none for
// a leftward drag.
export const swipeOffset = (dx: number) => {
  if (dx <= 0) {
    return 0;
  }
  if (dx <= SWIPE_REPLY_THRESHOLD_PX) {
    return dx;
  }
  return Math.min(
    SWIPE_MAX_PX,
    SWIPE_REPLY_THRESHOLD_PX + (dx - SWIPE_REPLY_THRESHOLD_PX) * DAMPING,
  );
};

export const isPastThreshold = (offset: number) =>
  offset >= SWIPE_REPLY_THRESHOLD_PX;

// 0..1 for the reply icon: hidden until 24 px, full at the threshold.
export const swipeIconProgress = (offset: number) =>
  Math.min(
    1,
    Math.max(
      0,
      (offset - SWIPE_ICON_START_PX) /
        (SWIPE_REPLY_THRESHOLD_PX - SWIPE_ICON_START_PX),
    ),
  );

// The key that replies to the focused bubble (without a modifier).
export const isReplyKey = (event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}) =>
  event.key.toLowerCase() === "r" &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey;
