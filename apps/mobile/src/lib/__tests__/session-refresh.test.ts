import { describe, expect, it, vi } from "vitest";

import { shouldRefreshSession, singleFlight } from "../session-refresh";

const now = new Date("2026-11-22T10:00:00Z");
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

describe("shouldRefreshSession", () => {
  it("renews an admin with less than 5 days left", () => {
    expect(shouldRefreshSession({ role: "admin", expiresAt: inDays(4), now })).toBe(true);
    expect(shouldRefreshSession({ role: "admin", expiresAt: inDays(6.5), now })).toBe(false);
  });

  it("leaves a sliding trainee session alone until 30 days remain", () => {
    expect(shouldRefreshSession({ role: "user", expiresAt: inDays(399), now })).toBe(false);
    expect(shouldRefreshSession({ role: "user", expiresAt: inDays(20), now })).toBe(true);
  });

  it("does not refresh an expired or unreadable expiry", () => {
    expect(shouldRefreshSession({ role: "admin", expiresAt: inDays(-1), now })).toBe(false);
    expect(shouldRefreshSession({ role: "admin", expiresAt: "nope", now })).toBe(false);
  });
});

describe("singleFlight", () => {
  it("shares one run between concurrent callers and allows a later one", async () => {
    let calls = 0;
    const run = singleFlight(async () => {
      calls += 1;
      return calls;
    });
    const spy = vi.fn();

    const [a, b] = await Promise.all([run(), run()]);

    spy(a, b);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(await run()).toBe(2);
  });
});
