import { describe, expect, it } from "vitest";

import {
  formatMuteUntil,
  isMuteActive,
  muteDurationSchema,
  resolveMuteUntil,
  toMuteState,
  tzOffsetSchema,
} from "@/features/chat/utils/mute-rules";

const NOW = new Date("2026-11-28T10:00:00Z");
const VN = -420;
const HOUR = 3_600_000;

describe("resolveMuteUntil", () => {
  it("adds hours for 1h, 4h and 8h", () => {
    expect(resolveMuteUntil("1h", NOW)?.toISOString()).toBe(
      "2026-11-28T11:00:00.000Z",
    );
    expect(resolveMuteUntil("4h", NOW)?.toISOString()).toBe(
      "2026-11-28T14:00:00.000Z",
    );
    expect(resolveMuteUntil("8h", NOW)?.toISOString()).toBe(
      "2026-11-28T18:00:00.000Z",
    );
  });

  it("returns null for forever", () => {
    expect(resolveMuteUntil("forever", NOW)).toBeNull();
  });

  it("is 08:00 the next local day for a UTC+7 browser", () => {
    // 17:00 local on 28 Nov -> 08:00 local on 29 Nov = 01:00Z.
    expect(resolveMuteUntil("tomorrow8", NOW, VN)?.toISOString()).toBe(
      "2026-11-29T01:00:00.000Z",
    );
  });

  it("is still tomorrow after local midnight, not today 08:00", () => {
    // 18:30Z = 01:30 local on 29 Nov -> 08:00 local on 30 Nov = 01:00Z.
    const late = new Date("2026-11-28T18:30:00Z");

    expect(resolveMuteUntil("tomorrow8", late, VN)?.toISOString()).toBe(
      "2026-11-30T01:00:00.000Z",
    );
  });

  it("handles a negative-offset zone (UTC-5)", () => {
    // 10:00Z = 05:00 local on 28 Nov -> 08:00 local on 29 Nov = 13:00Z.
    expect(resolveMuteUntil("tomorrow8", NOW, 300)?.toISOString()).toBe(
      "2026-11-29T13:00:00.000Z",
    );
  });

  it("defaults to UTC without an offset", () => {
    expect(resolveMuteUntil("tomorrow8", NOW)?.toISOString()).toBe(
      "2026-11-29T08:00:00.000Z",
    );
  });
});

describe("isMuteActive", () => {
  it("treats a null end as muted", () => {
    expect(isMuteActive({ mutedUntil: null }, NOW)).toBe(true);
  });

  it("is active before the end and expired at or after it", () => {
    expect(isMuteActive({ mutedUntil: new Date(NOW.getTime() + 1) }, NOW)).toBe(
      true,
    );
    expect(isMuteActive({ mutedUntil: new Date(NOW.getTime()) }, NOW)).toBe(
      false,
    );
    expect(
      isMuteActive({ mutedUntil: new Date(NOW.getTime() - 1000) }, NOW),
    ).toBe(false);
  });
});

describe("input schemas", () => {
  it("accepts only the five durations", () => {
    expect(muteDurationSchema.safeParse("tomorrow8").success).toBe(true);
    expect(muteDurationSchema.safeParse("2h").success).toBe(false);
    expect(muteDurationSchema.safeParse(undefined).success).toBe(false);
  });

  it("bounds the timezone offset to whole minutes within +-14 h", () => {
    expect(tzOffsetSchema.safeParse(-420).success).toBe(true);
    expect(tzOffsetSchema.safeParse(841).success).toBe(false);
    expect(tzOffsetSchema.safeParse(12.5).success).toBe(false);
    expect(tzOffsetSchema.safeParse("0").success).toBe(false);
  });
});

describe("toMuteState", () => {
  it("is unmuted without a row and for an expired row", () => {
    expect(toMuteState(undefined, NOW)).toEqual({ muted: false, until: null });
    expect(
      toMuteState({ mutedUntil: new Date(NOW.getTime() - 1) }, NOW),
    ).toEqual({ muted: false, until: null });
  });

  it("carries the end as ISO, null for forever", () => {
    const until = new Date(NOW.getTime() + HOUR);

    expect(toMuteState({ mutedUntil: until }, NOW)).toEqual({
      muted: true,
      until: until.toISOString(),
    });
    expect(toMuteState({ mutedUntil: null }, NOW)).toEqual({
      muted: true,
      until: null,
    });
  });
});

describe("formatMuteUntil", () => {
  const zone = "Asia/Ho_Chi_Minh";

  it("shows only the time when the end is today", () => {
    // NOW is 17:00 local; 11:00Z is 18:00 local the same day.
    expect(
      formatMuteUntil(new Date("2026-11-28T11:00:00Z"), NOW, "vi", zone),
    ).toBe("18:00");
  });

  it("adds the day and month when the end is another local day", () => {
    expect(
      formatMuteUntil(new Date("2026-11-29T01:00:00Z"), NOW, "vi", zone),
    ).toBe("08:00 29/11");
  });

  it("uses the 24-hour clock", () => {
    expect(
      formatMuteUntil(new Date("2026-11-28T16:05:00Z"), NOW, "en", zone),
    ).toBe("23:05");
  });
});
