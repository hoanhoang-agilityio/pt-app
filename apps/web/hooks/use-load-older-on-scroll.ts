"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { needsMoreToFill, shouldLoadOlder } from "@/utils/load-older-rules";

// Percentages, never px: they scale with the scroller, so the threshold stays
// proportional under browser zoom (25%..500%).
const ROOT_MARGIN = "50% 0px 0px 0px";
const MARGIN_RATIO = 0.5;

interface UseLoadOlderOnScrollArgs {
  // The scroll container; the sentinel must be inside it.
  rootRef: RefObject<HTMLElement | null>;
  hasMore: boolean;
  // Extra loading flag from the caller (the hook tracks its own as well).
  isLoading?: boolean;
  loadOlder: () => Promise<void>;
  // Identity of the oldest loaded item. A change means older items were
  // prepended; it drives scroll anchoring and the "no progress" check.
  firstKey: string | number | null;
  enabled?: boolean;
}

interface Anchor {
  height: number;
  top: number;
  firstKey: string | number | null;
}

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// Loads older messages when the top sentinel nears the scroll container, keeps
// the reader's place after the prepend, and keeps loading while the content
// does not fill the container (zoom out), one request at a time.
export const useLoadOlderOnScroll = ({
  rootRef,
  hasMore,
  isLoading: externalLoading = false,
  loadOlder,
  firstKey,
  enabled = true,
}: UseLoadOlderOnScrollArgs) => {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inFlight = useRef(false);
  const anchor = useRef<Anchor | null>(null);
  const latest = useRef({ hasMore, loadOlder, firstKey, enabled });

  useEffect(() => {
    latest.current = { hasMore, loadOlder, firstKey, enabled };
  });

  // Initial-mount guard. The thread scrolls itself to the bottom on mount
  // (layout effect in ChatThread, effect in DmThread), so at the first render
  // scrollTop is 0 and the sentinel looks visible. Observing then would load a
  // page nobody asked for and move the reader away from the latest message.
  // Two animation frames guarantee those scrolls have been applied and painted.
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
    const root = rootRef.current;
    const current = latest.current;

    if (inFlight.current || !current.hasMore || !current.enabled || !root) {
      return;
    }
    inFlight.current = true;
    anchor.current = {
      height: root.scrollHeight,
      top: root.scrollTop,
      firstKey: current.firstKey,
    };
    setError(null);
    setIsLoading(true);
    try {
      await current.loadOlder();
    } catch (caught) {
      anchor.current = null;
      setError(caught instanceof Error ? caught : new Error("load older"));
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, [rootRef]);

  const isBusy = isLoading || externalLoading;

  // Prepend finished: restore the reader's place (older items grew the content
  // above the viewport), or flag a request that returned nothing new while
  // `hasMore` still says there is more (the loaders swallow fetch errors, and
  // without this the fill loop below would hammer the server).
  useLayoutEffect(() => {
    const saved = anchor.current;
    const root = rootRef.current;

    if (!saved || !root) {
      return;
    }
    if (firstKey !== saved.firstKey) {
      root.scrollTop = saved.top + (root.scrollHeight - saved.height);
      anchor.current = null;
    } else if (!isBusy) {
      anchor.current = null;
      if (hasMore) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(new Error("no older messages returned"));
      }
    }
  }, [firstKey, isBusy, hasMore, rootRef]);

  // Is the sentinel inside the margin, or is there no scrolling at all? Read
  // from the layout, because after a load the observer does not re-fire when
  // the intersection state stayed the same.
  const isNearTop = useCallback(() => {
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
      sentinelRect.bottom >= rootRect.top - rootRect.height * MARGIN_RATIO &&
      sentinelRect.top <= rootRect.bottom
    );
  }, [rootRef, sentinel]);

  const hasError = error !== null;

  const maybeLoad = useCallback(
    (isSentinelVisible: boolean) => {
      if (
        shouldLoadOlder({
          hasMore,
          isLoading: isBusy || inFlight.current,
          hasError,
          isSentinelVisible: isSentinelVisible && enabled,
          isInitialised: isReady,
        })
      ) {
        void run();
      }
    },
    [hasMore, isBusy, hasError, enabled, isReady, run],
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

  // After every load (and on any state change): still near the top, or content
  // still short of the container? Load again. Bounded by `hasMore`, one at a
  // time, and stopped by an error.
  useEffect(() => {
    if (isReady && sentinel) {
      maybeLoad(isNearTop());
    }
  }, [isReady, sentinel, isNearTop, maybeLoad, firstKey]);

  // Manual load, also the retry after an error (ignores the sentinel).
  const retry = useCallback(() => {
    setError(null);
    void run();
  }, [run]);

  return { sentinelRef: setSentinel, isLoading: isBusy, error, retry };
};
