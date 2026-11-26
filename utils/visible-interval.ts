import { isUserIdle, onUserActive } from "@/utils/user-idle";

// A setInterval that only runs while the tab is visible and the user is
// active. Hidden: the timer is cleared. Back to visible: the callback runs once
// right away and the timer restarts. Idle (no input for USER_IDLE_MS): ticks
// are skipped, and the first activity afterwards runs the callback once right
// away. Returns a stop function (use it as a useEffect cleanup). The first run
// is the caller's: it is not called on start.
export const startVisibleInterval = (callback: () => void, ms: number) => {
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
  const tick = () => {
    if (!isUserIdle()) {
      callback();
    }
  };
  const start = () => {
    if (timer === null) {
      timer = setInterval(tick, ms);
    }
  };
  const onVisibility = () => {
    stop();
    if (document.visibilityState === "hidden") {
      return;
    }
    callback();
    start();
  };
  // Catch up once when the user returns from idle (the timer kept running).
  const offActive = onUserActive(() => {
    if (document.visibilityState !== "hidden") {
      callback();
    }
  });

  if (document.visibilityState !== "hidden") {
    start();
  }
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    stop();
    offActive();
    document.removeEventListener("visibilitychange", onVisibility);
  };
};
