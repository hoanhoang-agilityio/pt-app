// Client-only idle tracker. Background pollers pause after USER_IDLE_MS
// without a pointer, key, touch or scroll event, and resume (with one
// immediate run) on the next one. Listeners are attached lazily, once per tab.
export const USER_IDLE_MS = 5 * 60_000;

// Pure rule: idle once `idleMs` has passed since the last activity.
export const isIdleAt = (
  lastActivityAt: number,
  now: number,
  idleMs: number,
): boolean => now - lastActivityAt >= idleMs;

// A tracker with no DOM in it, so the idle -> active transition is testable.
export const createActivityTracker = (idleMs: number, startedAt: number) => {
  let lastActivityAt = startedAt;
  const listeners = new Set<() => void>();

  return {
    isIdle: (now: number) => isIdleAt(lastActivityAt, now, idleMs),
    // Records activity; listeners fire once when it ends an idle period.
    markActive: (now: number) => {
      const wasIdle = isIdleAt(lastActivityAt, now, idleMs);

      lastActivityAt = now;
      if (wasIdle) {
        [...listeners].forEach((listener) => listener());
      }
    },
    onActive: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "wheel",
  "scroll",
] as const;

let tracker: ReturnType<typeof createActivityTracker> | null = null;

const ensureTracker = () => {
  if (tracker !== null || typeof window === "undefined") {
    return tracker;
  }
  const created = createActivityTracker(USER_IDLE_MS, Date.now());

  tracker = created;
  const onActivity = () => created.markActive(Date.now());

  ACTIVITY_EVENTS.forEach((type) =>
    window.addEventListener(type, onActivity, { passive: true, capture: true }),
  );
  return created;
};

// False on the server and before the listeners exist.
export const isUserIdle = (now: number = Date.now()): boolean =>
  ensureTracker()?.isIdle(now) ?? false;

// Calls `listener` once each time the user acts after being idle.
export const onUserActive = (listener: () => void): (() => void) =>
  ensureTracker()?.onActive(listener) ?? (() => undefined);
