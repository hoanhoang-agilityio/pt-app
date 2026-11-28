"use client";

import { useCallback, useSyncExternalStore } from "react";

// True while the media query matches. False on the server and during
// hydration, so a phone-first layout renders first and desktop swaps in.
export const useMediaQuery = (query: string) => {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);

      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
};
