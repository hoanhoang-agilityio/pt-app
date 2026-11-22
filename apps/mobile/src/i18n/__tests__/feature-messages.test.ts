import { describe, expect, it } from "vitest";

import { deepMerge, featureMessages } from "../locales";

const flat = (value: unknown, prefix = ""): [string, string][] =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([key, child]) =>
        flat(child, prefix ? `${prefix}.${key}` : key),
      )
    : [[prefix, String(value)]];

const placeholders = (text: string) => (text.match(/{{\w+}}/g) ?? []).sort().join(",");

describe("feature message files", () => {
  const vi = flat(deepMerge({}, ...featureMessages.vi));
  const viMap = new Map(vi);

  it.each(["en", "zh"] as const)("%s has exactly the keys and placeholders of vi", (lang) => {
    const other = flat(deepMerge({}, ...featureMessages[lang]));

    expect(other.map(([key]) => key).sort()).toEqual(vi.map(([key]) => key).sort());
    for (const [key, text] of other) {
      expect(placeholders(text), key).toBe(placeholders(viMap.get(key) ?? ""));
    }
  });

  it("has no empty strings", () => {
    for (const lang of ["vi", "en", "zh"] as const) {
      for (const [key, text] of flat(deepMerge({}, ...featureMessages[lang]))) {
        expect(text.trim(), key).not.toBe("");
      }
    }
  });

  it("merges nested trees without dropping base keys", () => {
    expect(deepMerge({ a: { x: "1" } }, { a: { y: "2" } })).toEqual({ a: { x: "1", y: "2" } });
  });
});
