import { describe, expect, it } from "vitest";

import en from "../en.json";
import vi from "../vi.json";
import zh from "../zh.json";

const keysOf = (value: unknown, prefix = ""): string[] =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([key, child]) =>
        keysOf(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];

const placeholders = (text: string) => (text.match(/{{\w+}}/g) ?? []).sort().join(",");

const flat = (value: unknown, prefix = ""): [string, string][] =>
  typeof value === "object" && value !== null
    ? Object.entries(value).flatMap(([key, child]) =>
        flat(child, prefix ? `${prefix}.${key}` : key),
      )
    : [[prefix, String(value)]];

describe("message files", () => {
  const viKeys = keysOf(vi).sort();

  it.each([
    ["en", en],
    ["zh", zh],
  ])("%s has exactly the keys of vi", (_name, messages) => {
    expect(keysOf(messages).sort()).toEqual(viKeys);
  });

  it.each([
    ["en", en],
    ["zh", zh],
  ])("%s keeps the placeholders of vi", (_name, messages) => {
    const viMap = new Map(flat(vi));

    for (const [key, text] of flat(messages)) {
      expect(placeholders(text), key).toBe(placeholders(viMap.get(key) ?? ""));
    }
  });

  it("has no empty strings", () => {
    for (const messages of [vi, en, zh]) {
      for (const [key, text] of flat(messages)) {
        expect(text.trim(), key).not.toBe("");
      }
    }
  });
});
