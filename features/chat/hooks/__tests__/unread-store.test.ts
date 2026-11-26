import { describe, expect, it } from "vitest";

import {
  unreadFetchUrl,
  wantedQuery,
} from "@/features/chat/hooks/unread-store";

const subscriber = (query: string) => ({
  listener: () => undefined,
  pollMs: 30_000,
  query,
});

describe("unreadFetchUrl", () => {
  it("sends beat=1 from an attended page", () => {
    expect(unreadFetchUrl("/api/chat/unread", "", false)).toBe(
      "/api/chat/unread?beat=1",
    );
    expect(unreadFetchUrl("/api/chat/unread?as=admin", "peer=1", false)).toBe(
      "/api/chat/unread?as=admin&beat=1&peer=1",
    );
  });

  it("leaves beat=1 out while the user is idle, keeping the peer query", () => {
    expect(unreadFetchUrl("/api/chat/unread", "", true)).toBe(
      "/api/chat/unread",
    );
    expect(unreadFetchUrl("/api/chat/unread", "peer=1", true)).toBe(
      "/api/chat/unread?peer=1",
    );
  });
});

describe("wantedQuery", () => {
  it("merges the peers of every subscriber instead of the first one", () => {
    const subscribers = new Map<object, ReturnType<typeof subscriber>>([
      [{}, subscriber("")],
      [{}, subscriber("peerUserIds=5")],
      [{}, subscriber("peerUserIds=2")],
    ]);

    expect(wantedQuery({ subscribers })).toBe("peerUserIds=2,5");
  });
});
