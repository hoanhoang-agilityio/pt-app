import { describe, expect, it } from "vitest";

import {
  pairOf,
  parseSearchEmail,
  reportSchema,
} from "@/features/social/utils/friend-rules";

describe("pairOf", () => {
  it("orders a pair the same way both ways", () => {
    expect(pairOf(7, 3)).toEqual({ low: 3, high: 7 });
    expect(pairOf(3, 7)).toEqual({ low: 3, high: 7 });
  });
});

describe("parseSearchEmail", () => {
  it("trims and lower-cases a full address", () => {
    expect(parseSearchEmail("  An@Mail.COM ")).toBe("an@mail.com");
  });

  it.each(["", "an", "an@", "@mail.com", "an@mail", "a b@mail.com", 5, null])(
    "rejects %j",
    (value) => {
      expect(parseSearchEmail(value)).toBeNull();
    },
  );
});

describe("reportSchema", () => {
  it("defaults the reason to empty and trims it", () => {
    expect(
      reportSchema.parse({
        targetKind: "post",
        targetId: 1,
        reasonCode: "spam",
      }).reason,
    ).toBe("");
    expect(
      reportSchema.parse({
        targetKind: "user",
        targetId: 1,
        reasonCode: "other",
        reason: " x ",
      }).reason,
    ).toBe("x");
  });

  it("caps the reason at 500 characters and checks kind and id", () => {
    const base = { targetKind: "post", targetId: 1, reasonCode: "other" };

    expect(
      reportSchema.safeParse({ ...base, reason: "x".repeat(500) }).success,
    ).toBe(true);
    expect(
      reportSchema.safeParse({ ...base, reason: "x".repeat(501) }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({ ...base, targetKind: "admin" }).success,
    ).toBe(false);
    expect(reportSchema.safeParse({ ...base, targetId: 0 }).success).toBe(
      false,
    );
    expect(
      reportSchema.safeParse({ ...base, targetKind: "message" }).success,
    ).toBe(true);
  });

  it("needs a reason code from the fixed list", () => {
    const base = { targetKind: "post", targetId: 1 };

    expect(reportSchema.safeParse(base).success).toBe(false);
    expect(
      reportSchema.safeParse({ ...base, reasonCode: "rude" }).success,
    ).toBe(false);
    for (const reasonCode of [
      "spam",
      "harassment",
      "inappropriate",
      "scam",
      "other",
    ]) {
      expect(reportSchema.safeParse({ ...base, reasonCode }).success).toBe(
        true,
      );
    }
  });
});
