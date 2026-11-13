"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { needsMoreToFill, shouldLoadOlder } from "@/utils/load-older-rules";

// Percentages, never px: they scale with the scroller, so the threshold stays
// proportional under browser zoom (25%..500%).
const ROOT_MARGIN = "0px 0px 50% 0px";
const MARGIN_RATIO = 0.5;

interface UseLoadNewerOnScrollArgs {
  // The scroll container; the sentinel must be inside it.
  rootRef: RefObject<HTMLElement | null>;
  hasNewer: boolean;
  // Extra loading flag from the caller (the hook tracks its own as well).
  isLoading?: boolean;
  // Throws when the request failed.
  loadNewer: () => Promise<void>;
  // Identity of the newest loaded item; a change re-checks whether the
  // sentinel is still near (content may still be short of the container).
  lastKey: string | number | null;
}

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// Bottom twin of useLoadOlderOnScroll for a thread opened in the middle (a
// jump to an old message): loads the next newer page when the bottom sentinel
// nears the scroll container, one request at a time. Appending below the
// reader needs no scroll anchoring.
export const useLoadNewerOnScroll = ({
  rootRef,
  hasNewer,
  isLoading: externalLoading = false,
  loadNewer,
  lastKey,
}: UseLoadNewerOnScrollArgs) => {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inFlight = useRef(false);
  const latest = useRef({ hasNewer, loadNewer });

  useEffect(() => {
    latest.current = { hasNewer, loadNewer };
  });

  // Initial-mount guard: the thread scrolls to the bottom on mount and then
  // to the jump target, so at the first render the bottom sentinel looks
  // visible. Observing then would load a page before the jump has landed. Two
  // animation frames guarantee those scrolls have been applied.
  useEffect(() => {
    let cancelled = false;

    void nextFrame()
      .then(nextFrame)
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async () => {
    const current = latest.current;

    if (inFlight.current || !current.hasNewer) {
      return;
    }
    inFlight.current = true;
    setError(null);
    setIsLoading(true);
    try {
      await current.loadNewer();
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("load newer"));
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, []);

  const isBusy = isLoading || externalLoading;
  const hasError = error !== null;

  // Is the sentinel inside the margin, or is there no scrolling at all? Read
  // from the layout, because after a load the observer does not re-fire when
  // the intersection state stayed the same.
  const isNearBottom = useCallback(() => {
    const root = rootRef.current;

    if (!root || !sentinel) {
      return false;
    }
    if (needsMoreToFill(root)) {
      return true;
    }
    const rootRect = root.getBoundingClientRect();
    const sentinelRect = sentinel.getBoundingClientRect();

    return (
      sentinelRect.top <= rootRect.bottom + rootRect.height * MARGIN_RATIO &&
      sentinelRect.bottom >= rootRect.top
    );
  }, [rootRef, sentinel]);

  const maybeLoad = useCallback(
    (isSentinelVisible: boolean) => {
      // Same conditions as for older messages, seen from the other edge.
      if (
        shouldLoadOlder({
          hasMore: hasNewer,
          isLoading: isBusy || inFlight.current,
          hasError,
          isSentinelVisible,
          isInitialised: isReady,
        })
      ) {
        void run();
      }
    },
    [hasNewer, isBusy, hasError, isReady, run],
  );

  useEffect(() => {
    const root = rootRef.current;

    if (
      !root ||
      !sentinel ||
      !isReady ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          maybeLoad(true);
        }
      },
      { root, rootMargin: ROOT_MARGIN },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [rootRef, sentinel, isReady, maybeLoad]);

  // After every load: still near the bottom? Load again. Bounded by
  // `hasNewer`, one at a time, and stopped by an error.
  useEffect(() => {
    if (isReady && sentinel) {
      maybeLoad(isNearBottom());
    }
  }, [isReady, sentinel, isNearBottom, maybeLoad, lastKey]);

  // Manual load, also the retry after an error (ignores the sentinel).
  const retry = useCallback(() => {
    setError(null);
    void run();
  }, [run]);

  return { sentinelRef: setSentinel, isLoading: isBusy, error, retry };
};
