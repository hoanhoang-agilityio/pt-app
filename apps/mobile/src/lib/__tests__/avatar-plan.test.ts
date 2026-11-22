import { AVATAR_MAX_DATA_URL_LENGTH, CHAT_COLOR_KEYS } from "@pt/contracts";
import { describe, expect, it } from "vitest";

import {
  AVATAR_QUALITIES,
  CHAT_COLORS,
  fitsAvatar,
  pickAvatarQuality,
  toDataUrl,
} from "../avatar-plan";

describe("avatar plan", () => {
  it("builds a data URL", () => {
    expect(toDataUrl("AAAA")).toBe("data:image/jpeg;base64,AAAA");
  });
  it("accepts a data URL exactly at the limit and refuses one byte more", () => {
    expect(fitsAvatar("x".repeat(AVATAR_MAX_DATA_URL_LENGTH))).toBe(true);
    expect(fitsAvatar("x".repeat(AVATAR_MAX_DATA_URL_LENGTH + 1))).toBe(false);
  });
  it("lowers the quality until the result fits", () => {
    const sizes = new Map<number, number>([
      [0.8, AVATAR_MAX_DATA_URL_LENGTH + 500],
      [0.6, AVATAR_MAX_DATA_URL_LENGTH + 1],
      [0.4, AVATAR_MAX_DATA_URL_LENGTH - 10],
    ]);
    const picked = pickAvatarQuality((quality) => "x".repeat(sizes.get(quality) ?? 1));

    expect(picked?.quality).toBe(0.4);
  });
  it("gives up when even the lowest quality is too big", () => {
    expect(pickAvatarQuality(() => "x".repeat(AVATAR_MAX_DATA_URL_LENGTH + 1))).toBeNull();
    expect(AVATAR_QUALITIES.length).toBeGreaterThan(1);
  });
  it("has a colour for every chat colour key", () => {
    for (const key of CHAT_COLOR_KEYS) {
      expect(CHAT_COLORS[key]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
