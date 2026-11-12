import clsx from "clsx";

import { WaveDots } from "@/components/common/WaveDots";

interface LoadOlderControlProps {
  // Put on the sentinel; the hook watches it.
  sentinelRef: (node: HTMLElement | null) => void;
  hasMore: boolean;
  isLoading: boolean;
  hasError: boolean;
  hasItems: boolean;
  onLoad: () => void;
  labels: {
    loading: string;
    loadOlder: string;
    retry: string;
    start: string;
  };
  className?: string;
}

const LINK_BUTTON =
  "rounded-full px-3 py-1.5 text-xs font-medium text-muted underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent";

// Top of a message list: the scroll sentinel, the loading dots, a compact
// button for keyboard and screen-reader users (and for retry), and the start
// marker once everything is loaded. The row keeps one height in every state so
// the content does not jump when the state changes.
export const LoadOlderControl = ({
  sentinelRef,
  hasMore,
  isLoading,
  hasError,
  hasItems,
  onLoad,
  labels,
  className,
}: LoadOlderControlProps) => {
  if (!hasMore) {
    return hasItems ? (
      <p className={clsx("py-3 text-center text-xs text-muted", className)}>
        {labels.start}
      </p>
    ) : null;
  }
  return (
    <div className={className}>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      <div className="flex h-10 items-center justify-center">
        {isLoading ? (
          <div role="status">
            <WaveDots />
            <span className="sr-only">{labels.loading}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLoad}
            className={clsx(LINK_BUTTON, hasError && "text-danger")}
          >
            {hasError ? labels.retry : labels.loadOlder}
          </button>
        )}
      </div>
    </div>
  );
};
