export interface LoadOlderState {
  hasMore: boolean;
  isLoading: boolean;
  hasError: boolean;
  // The top sentinel is inside the (percentage) margin around the scroller.
  isSentinelVisible: boolean;
  // The first scroll-to-bottom on mount has happened.
  isInitialised: boolean;
}

// Whether a thread should request its next page of older messages now.
export const shouldLoadOlder = ({
  hasMore,
  isLoading,
  hasError,
  isSentinelVisible,
  isInitialised,
}: LoadOlderState): boolean =>
  hasMore && !isLoading && !hasError && isSentinelVisible && isInitialised;

// The content does not overflow the scroller (e.g. after zooming out), so no
// scroll can ever bring the sentinel into view: keep loading to fill it.
export const needsMoreToFill = ({
  scrollHeight,
  clientHeight,
}: {
  scrollHeight: number;
  clientHeight: number;
}): boolean => scrollHeight <= clientHeight;
