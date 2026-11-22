import { describe, expect, it } from "vitest";

import { CHAT_PALETTE, chatColorHex, DEFAULT_CHAT_COLOR, ownBubbleColor } from "../chat-colors";

describe("chat colours", () => {
  it("maps a key to its hex and falls back to the default", () => {
    expect(chatColorHex("blue")).toBe(CHAT_PALETTE.blue);
    expect(chatColorHex("nope")).toBe(CHAT_PALETTE[DEFAULT_CHAT_COLOR]);
    expect(chatColorHex(null)).toBe(CHAT_PALETTE[DEFAULT_CHAT_COLOR]);
  });

  it("prefers the conversation colour over the account colour", () => {
    expect(ownBubbleColor({ "admin:3": "teal" }, "admin:3", "red").bg).toBe(CHAT_PALETTE.teal);
    expect(ownBubbleColor({}, "user", "red").bg).toBe(CHAT_PALETTE.red);
    expect(ownBubbleColor(undefined, "user", undefined).bg).toBe(CHAT_PALETTE.orange);
  });
});
