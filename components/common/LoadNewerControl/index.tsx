import clsx from "clsx";

import { WaveDots } from "@/components/common/WaveDots";

interface LoadNewerControlProps {
  // Put on the sentinel; the hook watches it.
  sentinelRef: (node: HTMLElement | null) => void;
  hasNewer: boolean;
  isLoading: boolean;
  hasError: boolean;
  onLoad: () => void;
  labels: {
    loading: string;
    loadNewer: string;
    retry: string;
  };
  className?: string;
}

const LINK_BUTTON =
  "rounded-full px-3 py-1.5 text-xs font-medium text-muted underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent";

// Bottom of a message list opened in the middle: the scroll sentinel, the
// loading dots and a compact button for keyboard and screen-reader users (and
// for retry). Renders nothing once the newest message is loaded.
export const LoadNewerControl = ({
  sentinelRef,
  hasNewer,
  isLoading,
  hasError,
  onLoad,
  labels,
  className,
}: LoadNewerControlProps) => {
  if (!hasNewer) {
    return null;
  }
  return (
    <div className={className}>
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
            {hasError ? labels.retry : labels.loadNewer}
          </button>
        )}
      </div>
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </div>
  );
};
