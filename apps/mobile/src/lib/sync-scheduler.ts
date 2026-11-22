// Runs `round` one at a time. A request that arrives while a round is in flight
// is not dropped: it marks the scheduler dirty and exactly one more round runs
// after the current one (any number of requests collapse into that one).
export const createSyncScheduler = (round: () => Promise<void>) => {
  let running = false;
  let dirty = false;

  return async () => {
    if (running) {
      dirty = true;
      return;
    }
    running = true;
    try {
      do {
        dirty = false;
        await round();
      } while (dirty);
    } finally {
      running = false;
    }
  };
};
