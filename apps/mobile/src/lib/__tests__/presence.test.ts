import { describe, expect, it } from "vitest";

import { presenceView, sinceText } from "../presence";

const labels = {
  online: "Online",
  now: "just now",
  minutes: "{{count}} min",
  hours: "{{count}} h",
  days: "{{count}} d",
  lastSeen: (when: string) => `Active ${when}`,
};
const NOW = "2026-11-22T10:00:00.000Z";

describe("sinceText", () => {
  it("picks the unit by the gap on the server clock", () => {
    expect(sinceText("2026-11-22T09:59:30.000Z", NOW, labels)).toBe("just now");
    expect(sinceText("2026-11-22T09:55:00.000Z", NOW, labels)).toBe("5 min");
    expect(sinceText("2026-11-22T07:00:00.000Z", NOW, labels)).toBe("3 h");
    expect(sinceText("2026-11-20T10:00:00.000Z", NOW, labels)).toBe("2 d");
  });

  it("never goes negative when the phone clock differs", () => {
    expect(sinceText("2026-11-22T10:05:00.000Z", NOW, labels)).toBe("just now");
  });
});

describe("presenceView", () => {
  it("shows online, last seen, or nothing", () => {
    expect(presenceView({ peerLastSeenAt: null, serverNow: NOW, peerOnline: true }, labels)).toEqual({
      online: true,
      text: "Online",
    });
    expect(
      presenceView({ peerLastSeenAt: "2026-11-22T09:50:00.000Z", serverNow: NOW, peerOnline: false }, labels),
    ).toEqual({ online: false, text: "Active 10 min" });
    expect(presenceView({ peerLastSeenAt: null, serverNow: NOW, peerOnline: false }, labels).text).toBeNull();
    expect(presenceView(undefined, labels).text).toBeNull();
  });
});
