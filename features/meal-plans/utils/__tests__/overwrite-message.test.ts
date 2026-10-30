import { describe, expect, it } from "vitest";

import {
  formatOverwriteQuestion,
  getOverwriteDates,
} from "@/features/meal-plans/utils/overwrite-message";

describe("getOverwriteDates", () => {
  it("keeps only chosen dates that have a plan, sorted", () => {
    expect(
      getOverwriteDates(
        ["2026-10-29", "2026-10-28", "2026-10-27"],
        ["2026-10-27", "2026-10-29", "2026-11-02"],
      ),
    ).toEqual(["2026-10-27", "2026-10-29"]);
  });

  it("is empty when no chosen date has a plan", () => {
    expect(getOverwriteDates(["2026-10-28"], ["2026-10-27"])).toEqual([]);
  });
});

describe("formatOverwriteQuestion", () => {
  it("lists weekday and day/month", () => {
    // 2026-10-27 is a Tuesday, 2026-10-29 a Thursday.
    expect(formatOverwriteQuestion(["2026-10-27", "2026-10-29"])).toBe(
      "Ghi đè plan của T3 27/10, T5 29/10?",
    );
  });
});
