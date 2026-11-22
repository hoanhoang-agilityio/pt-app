import { describe, expect, it } from "vitest";

import {
  fitsUpload,
  nextQualityIndex,
  PHOTO_MAX_BYTES,
  PHOTO_TARGET_BYTES,
  photoSlots,
  planResize,
  sizeAfter,
} from "../image-plan";

describe("planResize", () => {
  it("leaves a photo that already fits", () => {
    expect(planResize(1600, 900)).toBeNull();
    expect(planResize(800, 1600)).toBeNull();
  });

  it("fits the long side into 1600 px", () => {
    expect(planResize(4032, 3024)).toEqual({ width: 1600 });
    expect(planResize(3024, 4032)).toEqual({ height: 1600 });
  });

  it("ignores unusable sizes", () => {
    expect(planResize(0, 100)).toBeNull();
  });
});

describe("sizeAfter", () => {
  it("keeps the aspect ratio", () => {
    expect(sizeAfter(4032, 3024, { width: 1600 })).toEqual({ width: 1600, height: 1200 });
    expect(sizeAfter(3024, 4032, { height: 1600 })).toEqual({ width: 1200, height: 1600 });
    expect(sizeAfter(100, 50, null)).toEqual({ width: 100, height: 50 });
  });
});

describe("quality steps and upload limit", () => {
  it("stops once the target is met or the qualities run out", () => {
    expect(nextQualityIndex(0, PHOTO_TARGET_BYTES)).toBeNull();
    expect(nextQualityIndex(0, PHOTO_TARGET_BYTES + 1)).toBe(1);
    expect(nextQualityIndex(3, PHOTO_MAX_BYTES)).toBeNull();
  });

  it("accepts only 1..1.5 MB bodies", () => {
    expect(fitsUpload(PHOTO_MAX_BYTES)).toBe(true);
    expect(fitsUpload(PHOTO_MAX_BYTES + 1)).toBe(false);
    expect(fitsUpload(0)).toBe(false);
  });

  it("counts photo slots", () => {
    expect(photoSlots(8, 5, 10)).toEqual({ accept: 2, dropped: 3 });
    expect(photoSlots(10, 1, 10)).toEqual({ accept: 0, dropped: 1 });
    expect(photoSlots(0, 3, 10)).toEqual({ accept: 3, dropped: 0 });
  });
});
