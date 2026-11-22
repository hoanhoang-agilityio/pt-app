import { describe, expect, it } from "vitest";

import { createSyncScheduler } from "../sync-scheduler";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });

  return { promise, resolve };
};

describe("createSyncScheduler", () => {
  it("runs one round for a single request", async () => {
    let rounds = 0;
    const sync = createSyncScheduler(async () => {
      rounds += 1;
    });

    await sync();
    expect(rounds).toBe(1);
  });

  it("runs exactly one extra round for requests made while one is in flight", async () => {
    const gates = [deferred(), deferred()];
    let rounds = 0;
    const sync = createSyncScheduler(async () => {
      const gate = gates[rounds];

      rounds += 1;
      await gate?.promise;
    });
    const first = sync();

    await sync();
    await sync();
    await sync();
    expect(rounds).toBe(1);
    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(rounds).toBe(2);
    gates[1].resolve();
    await first;
    expect(rounds).toBe(2);
  });

  it("can run again after finishing, even after a failing round", async () => {
    let rounds = 0;
    const sync = createSyncScheduler(async () => {
      rounds += 1;
      if (rounds === 1) {
        throw new Error("boom");
      }
    });

    await expect(sync()).rejects.toThrow("boom");
    await sync();
    expect(rounds).toBe(2);
  });
});
