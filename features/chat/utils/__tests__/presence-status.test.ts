import { describe, expect, it } from "vitest";

import {
  clockSkewMs,
  mergeLastSeen,
  parsePeerReading,
  peerUnreadQuery,
  presenceView,
  serverClockNow,
  shortLastSeen,
  shouldRunPresence,
} from "@/features/chat/utils/presence-status";

const NOW = new Date("2026-05-10T05:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("presenceView", () => {
  it("is online with the online label under 2 minutes", () => {
    expect(presenceView(ago(119_000), NOW)).toEqual({
      online: true,
      text: "Đang hoạt động",
    });
  });

  it("shows minutes ago and is offline from 2 minutes", () => {
    expect(presenceView(ago(120_000), NOW)).toEqual({
      online: false,
      text: "Hoạt động 2 phút trước",
    });
  });

  it("shows nothing when never seen", () => {
    expect(presenceView(null, NOW)).toEqual({ online: false, text: null });
  });
});

describe("shortLastSeen", () => {
  it("drops the prefix", () => {
    expect(shortLastSeen(ago(5 * 60_000), NOW)).toBe("5 phút trước");
  });

  it("is null when online or never seen", () => {
    expect(shortLastSeen(ago(10_000), NOW)).toBeNull();
    expect(shortLastSeen(null, NOW)).toBeNull();
  });

  it("keeps the yesterday wording without the prefix", () => {
    expect(shortLastSeen(ago(24 * 3_600_000), NOW)).toBe("hôm qua");
  });
});

describe("peerUnreadQuery", () => {
  it("builds the unread query per role", () => {
    expect(peerUnreadQuery("user", 7)).toBe("peer=1");
    expect(peerUnreadQuery("admin", 7)).toBe("peerUserIds=7");
  });
});

describe("parsePeerReading", () => {
  it("reads both fields", () => {
    expect(
      parsePeerReading({
        count: 1,
        peerLastSeenAt: "2026-05-10T04:00:00.000Z",
        serverNow: "2026-05-10T05:00:00.000Z",
      }),
    ).toEqual({
      peerLastSeenAt: "2026-05-10T04:00:00.000Z",
      serverNow: "2026-05-10T05:00:00.000Z",
    });
  });

  it("keeps a null last-seen (never seen) with the server clock", () => {
    expect(
      parsePeerReading({
        peerLastSeenAt: null,
        serverNow: "2026-05-10T05:00:00.000Z",
      }),
    ).toEqual({
      peerLastSeenAt: null,
      serverNow: "2026-05-10T05:00:00.000Z",
    });
  });

  it("reads an admin's own trainee out of peers", () => {
    const payload = {
      serverNow: "2026-05-10T05:00:00.000Z",
      peers: {
        "3": { peerLastSeenAt: "2026-05-10T04:00:00.000Z" },
        "7": { peerLastSeenAt: "2026-05-10T04:30:00.000Z" },
      },
    };

    expect(parsePeerReading(payload, 7)?.peerLastSeenAt).toBe(
      "2026-05-10T04:30:00.000Z",
    );
    expect(parsePeerReading(payload, 3)?.peerLastSeenAt).toBe(
      "2026-05-10T04:00:00.000Z",
    );
  });

  it("keeps the server clock when the admin's trainee is not in peers", () => {
    expect(
      parsePeerReading({ serverNow: "2026-05-10T05:00:00.000Z", peers: {} }, 9),
    ).toEqual({
      peerLastSeenAt: null,
      serverNow: "2026-05-10T05:00:00.000Z",
    });
    expect(parsePeerReading({ count: 1 }, 9)).toBeNull();
  });

  it("is null without peer fields or without a payload", () => {
    expect(parsePeerReading({ count: 1 })).toBeNull();
    expect(parsePeerReading(null)).toBeNull();
    expect(parsePeerReading("x")).toBeNull();
  });
});

describe("mergeLastSeen", () => {
  const older = "2026-05-10T04:00:00.000Z";
  const newer = "2026-05-10T04:30:00.000Z";

  it("takes the newer reading", () => {
    expect(mergeLastSeen(new Date(older), newer)?.toISOString()).toBe(newer);
  });

  it("never goes backwards", () => {
    expect(mergeLastSeen(new Date(newer), older)?.toISOString()).toBe(newer);
  });

  it("ignores missing or invalid input", () => {
    expect(mergeLastSeen(new Date(newer), undefined)?.toISOString()).toBe(
      newer,
    );
    expect(mergeLastSeen(null, "nope")).toBeNull();
    expect(mergeLastSeen(null, newer)?.toISOString()).toBe(newer);
  });
});

describe("shouldRunPresence", () => {
  it("runs only while visible", () => {
    expect(shouldRunPresence("visible")).toBe(true);
    expect(shouldRunPresence("hidden")).toBe(false);
  });
});

// KAN-156: the admin thread showed an idle trainee as "Đang hoạt động" when
// the admin's device clock ran behind the server's. Last-seen is stamped by
// the server; judging it on the device clock put it inside (or after) "now".
describe("device clock behind the server", () => {
  const FIVE_MIN = 5 * 60_000;
  const lastSeen = ago(FIVE_MIN);
  const deviceNow = new Date(NOW.getTime() - 10 * 60_000);

  it("reproduces the bug: the raw device clock reads an idle trainee as online", () => {
    expect(presenceView(lastSeen, deviceNow)).toEqual({
      online: true,
      text: "Đang hoạt động",
    });
  });

  it("measures the skew from the server timestamp and judges on the server clock", () => {
    const skew = clockSkewMs(NOW.toISOString(), deviceNow.getTime());

    expect(skew).toBe(10 * 60_000);
    expect(
      presenceView(lastSeen, serverClockNow(deviceNow.getTime(), skew)),
    ).toEqual({ online: false, text: "Hoạt động 5 phút trước" });
  });

  it("keeps a fresh heartbeat online on a correct clock", () => {
    const skew = clockSkewMs(NOW.toISOString(), NOW.getTime());

    expect(skew).toBe(0);
    expect(
      presenceView(ago(30_000), serverClockNow(NOW.getTime(), skew)).online,
    ).toBe(true);
  });

  it("falls back to no skew without a usable server time", () => {
    expect(clockSkewMs(null, 1)).toBe(0);
    expect(clockSkewMs(undefined, 1)).toBe(0);
    expect(clockSkewMs("nope", 1)).toBe(0);
  });
});
