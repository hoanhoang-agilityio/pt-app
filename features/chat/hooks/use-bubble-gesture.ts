"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createGestureTracker,
  type GestureHandlers,
} from "@/features/chat/utils/gesture";
import {
  isPastThreshold,
  isReplyKey,
  swipeIconProgress,
} from "@/features/chat/utils/swipe-reply";

const HAPTIC_MS = 10;
// A click this soon after a swipe is the tail of the swipe, not a tap.
const SWIPE_CLICK_GUARD_MS = 400;

// The element the swipe moves (the bubble row) and draws the reply icon on.
// The hook writes CSS variables on it; the markup reads them.
export const SWIPE_ROOT_ATTRIBUTE = "data-swipe-root";

// Controls inside a bubble (retry, quote, chips, "edited") keep their own
// taps; they never start a gesture. The tiles of a photo grid opt out
// (data-gesture-through): double-tap and long-press work on the photos too.
const isInteractiveTarget = (target: EventTarget) => {
  const control =
    target instanceof Element ? target.closest("button, a") : null;

  return control !== null && control.closest("[data-gesture-through]") === null;
};

// Draws the swipe: --swipe-x (px the row moved), --swipe-p (0..1 icon
// progress) and data-armed once releasing would reply. Written straight to the
// element while the finger moves (no re-render); with the finger gone the
// variables are removed and the CSS transition springs the row back.
const paintSwipe = (root: HTMLElement | null, offset: number) => {
  if (!root) {
    return;
  }
  if (offset <= 0) {
    delete root.dataset.swiping;
    delete root.dataset.armed;
    root.style.removeProperty("--swipe-x");
    root.style.removeProperty("--swipe-p");
    return;
  }
  root.dataset.swiping = "";
  if (isPastThreshold(offset)) {
    root.dataset.armed = "";
  } else {
    delete root.dataset.armed;
  }
  root.style.setProperty("--swipe-x", `${offset}px`);
  root.style.setProperty("--swipe-p", String(swipeIconProgress(offset)));
};

interface BubbleGestureHandlers extends Omit<GestureHandlers, "onSwipeReply"> {
  // Reply to this message: a left-to-right swipe, or the R key.
  onReply?: () => void;
}

// Pointer handlers for one bubble: double-tap, long-press, swipe to reply, and
// the keyboard / context-menu route to the same actions. `isEnabled` false =
// inert. A handler left out turns its gesture off.
export const useBubbleGesture = (
  isEnabled: boolean,
  { onDoubleTap, onLongPress, onSingleTap, onReply }: BubbleGestureHandlers,
) => {
  const [tracker] = useState(() =>
    createGestureTracker({ onDoubleTap, onLongPress, onSingleTap }),
  );
  const rootRef = useRef<HTMLElement | null>(null);
  const capturedRef = useRef<number | null>(null);
  const swipedAtRef = useRef(0);
  // The one pointer being tracked; a second finger is ignored until it lifts.
  const activePointerRef = useRef<number | null>(null);
  const isOtherPointer = (event: PointerEvent) =>
    activePointerRef.current !== null &&
    activePointerRef.current !== event.pointerId;

  // Latest callbacks, without rebuilding the tracker (and losing a pending tap).
  useEffect(() => {
    tracker.setHandlers({
      onDoubleTap,
      onSingleTap,
      onLongPress: onLongPress
        ? () => {
            navigator.vibrate?.(HAPTIC_MS);
            onLongPress();
          }
        : undefined,
      ...(onReply
        ? {
            onSwipeReply: onReply,
            onSwipeMove: (offset: number) =>
              paintSwipe(rootRef.current, offset),
            onSwipeThreshold: () => navigator.vibrate?.(HAPTIC_MS),
          }
        : {}),
    });
  });

  useEffect(() => () => tracker.dispose(), [tracker]);

  if (!isEnabled) {
    return {};
  }
  return {
    onPointerDown: (event: PointerEvent) => {
      // Only the primary button / finger; a right click is the context menu.
      if (
        event.button !== 0 ||
        isOtherPointer(event) ||
        isInteractiveTarget(event.target)
      ) {
        return;
      }
      activePointerRef.current = event.pointerId;
      // A new press: a click guard left by an earlier swipe must not eat it.
      swipedAtRef.current = 0;
      rootRef.current = event.currentTarget.closest<HTMLElement>(
        `[${SWIPE_ROOT_ATTRIBUTE}]`,
      );
      tracker.down(
        { x: event.clientX, y: event.clientY },
        // Dragging with a mouse is selecting, not replying.
        { canSwipe: event.pointerType !== "mouse" },
      );
    },
    onPointerMove: (event: PointerEvent) => {
      if (isOtherPointer(event)) {
        return;
      }
      tracker.move({ x: event.clientX, y: event.clientY });
      if (tracker.isSwiping()) {
        swipedAtRef.current = Date.now();
        // Keep the move / up events coming even if the finger leaves the bubble.
        if (capturedRef.current !== event.pointerId) {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
            capturedRef.current = event.pointerId;
          } catch {
            // A pointer that is already gone: nothing to capture.
          }
        }
      }
    },
    onPointerUp: (event: PointerEvent) => {
      if (isOtherPointer(event)) {
        return;
      }
      activePointerRef.current = null;
      if (tracker.isSwiping()) {
        swipedAtRef.current = Date.now();
      }
      capturedRef.current = null;
      tracker.up({ x: event.clientX, y: event.clientY });
    },
    // The browser took the touch over to scroll.
    onPointerCancel: (event: PointerEvent) => {
      if (isOtherPointer(event)) {
        return;
      }
      activePointerRef.current = null;
      capturedRef.current = null;
      tracker.cancel();
    },
    onPointerLeave: (event: PointerEvent) => {
      if (isOtherPointer(event)) {
        return;
      }
      activePointerRef.current = null;
      tracker.cancel();
    },
    // A swipe that ends over a photo tile or link must not also click it.
    onClickCapture: (event: MouseEvent) => {
      if (Date.now() - swipedAtRef.current < SWIPE_CLICK_GUARD_MS) {
        event.preventDefault();
        event.stopPropagation();
        swipedAtRef.current = 0;
      }
    },
    // Long press on Android and right click on desktop.
    ...(onLongPress
      ? {
          onContextMenu: (event: MouseEvent) => {
            event.preventDefault();
            if (!isInteractiveTarget(event.target)) {
              onLongPress();
            }
          },
        }
      : {}),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (
        onLongPress &&
        (event.key === "Enter" ||
          event.key === "ContextMenu" ||
          (event.key === "F10" && event.shiftKey))
      ) {
        event.preventDefault();
        onLongPress();
        return;
      }
      if (onReply && isReplyKey(event)) {
        event.preventDefault();
        onReply();
      }
    },
  };
};
