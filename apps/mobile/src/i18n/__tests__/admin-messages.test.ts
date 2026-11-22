import { describe, expect, it } from "vitest";

import en from "../locales/en/admin.json";
import vi from "../locales/vi/admin.json";
import zh from "../locales/zh/admin.json";

const flat = (value: unknown, prefix = ""): [string, string][] =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([key, child]) => flat(child, prefix ? `${prefix}.${key}` : key))
    : [[prefix, String(value)]];

const placeholders = (text: string) => (text.match(/{{\w+}}/g) ?? []).sort().join(",");

describe("admin message files", () => {
  const viMap = new Map(flat(vi));

  it.each([
    ["en", en],
    ["zh", zh],
  ])("%s has exactly the keys and placeholders of vi", (_name, messages) => {
    const map = new Map(flat(messages));

    expect([...map.keys()].sort()).toEqual([...viMap.keys()].sort());
    for (const [key, text] of map) {
      expect(placeholders(text), key).toBe(placeholders(viMap.get(key) ?? ""));
    }
  });

  it("has no empty strings", () => {
    for (const [key, text] of viMap) {
      expect(text.trim(), key).not.toBe("");
    }
  });
});
