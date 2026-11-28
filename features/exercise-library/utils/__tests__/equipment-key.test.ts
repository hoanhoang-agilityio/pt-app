import { describe, expect, it } from "vitest";

import { matchEquipmentKey } from "@/features/exercise-library/utils/equipment-key";

describe("matchEquipmentKey", () => {
  it.each([
    ["Tạ đơn", "dumbbell"],
    ["ta don", null],
    ["ta dom", null],
    ["ta am", "kettlebells"],
    ["dây kháng lực", "bands"],
    ["day khang luc", "bands"],
    ["  TẠ ĐÒN ", "barbell"],
    ["Dumbbells", "dumbbell"],
    ["Kettlebell", "kettlebells"],
    ["kettlebells", "kettlebells"],
    ["Body only", "body_only"],
    ["Không dụng cụ", "body_only"],
    ["EZ-curl bar", "e_z_curl_bar"],
    ["Dây kháng lực", "bands"],
    ["Resistance band", null],
    ["杠铃", "barbell"],
  ])("reads %j as %j", (text, key) => {
    expect(matchEquipmentKey(text)).toBe(key);
  });

  it("returns null for unknown or empty text", () => {
    expect(matchEquipmentKey("Dây thừng nhảy")).toBeNull();
    expect(matchEquipmentKey("")).toBeNull();
    expect(matchEquipmentKey(null)).toBeNull();
  });
});
