import { describe, expect, it } from "vitest";

import { resolveAccent } from "../resolve-accent";
import { buildThemeCss } from "../theme-css";

describe("resolveAccent", () => {
  it("prefers self over role over all", () => {
    expect(
      resolveAccent({ self: "#111111", role: "#222222", all: "#333333" }),
    ).toBe("#111111");
    expect(resolveAccent({ self: null, role: "#222222", all: "#333333" })).toBe(
      "#222222",
    );
    expect(resolveAccent({ self: null, role: null, all: "#333333" })).toBe(
      "#333333",
    );
  });

  it("returns null for the default", () => {
    expect(resolveAccent({})).toBeNull();
    expect(
      resolveAccent({ self: null, role: undefined, all: null }),
    ).toBeNull();
  });

  it("skips a stored value that fails normalization", () => {
    expect(
      resolveAccent({ self: "javascript:1", role: "#ABC", all: "#333333" }),
    ).toBe("#aabbcc");
    expect(resolveAccent({ self: "bad", role: "worse", all: "#333333" })).toBe(
      "#333333",
    );
    expect(
      resolveAccent({ self: "bad", role: "worse", all: "worst" }),
    ).toBeNull();
  });
});

describe("buildThemeCss", () => {
  it("writes the light block and both dark selectors for a blue", () => {
    const css = buildThemeCss("#2563EB");

    expect(css).not.toBeNull();
    expect(css).toContain(
      ":root{--accent:#2563eb;--accent-fg:#ffffff;--chart-weight:#2563eb;}",
    );
    expect(css).toContain(
      '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]):not([data-theme="dark"]){',
    );
    expect(css).toContain(':root[data-theme="dark"]{');
  });

  it("uses the same dark values in both dark blocks", () => {
    const lines = (buildThemeCss("#7c3aed") ?? "").split("\n");
    const media =
      /\{--accent:(#[0-9a-f]{6});--accent-fg:(#[0-9a-f]{6});--chart-weight:(#[0-9a-f]{6});\}\}$/.exec(
        lines[1],
      );
    const forced =
      /\{--accent:(#[0-9a-f]{6});--accent-fg:(#[0-9a-f]{6});--chart-weight:(#[0-9a-f]{6});\}$/.exec(
        lines[2],
      );

    expect(media?.slice(1)).toEqual(forced?.slice(1));
    expect(media?.[1]).toBe(media?.[3]);
  });

  it("returns null and never echoes bad input", () => {
    expect(buildThemeCss(null)).toBeNull();
    expect(buildThemeCss("red")).toBeNull();
    expect(buildThemeCss("#fff;}</style><script>x</script>")).toBeNull();
  });
});
