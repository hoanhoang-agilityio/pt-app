import { describe, expect, it } from "vitest";

import {
  DEFAULT_API_URL,
  isApiTarget,
  isDevelopmentBuild,
  normalizeApiUrl,
  pickApiUrl,
  resolveBuildApiUrl,
} from "../api-url";

describe("pickApiUrl", () => {
  it("falls through an empty env var to the next candidate", () => {
    expect(pickApiUrl("", "https://api.example.com/")).toBe("https://api.example.com");
    expect(pickApiUrl(undefined, "  ", "https://b.example.com")).toBe("https://b.example.com");
  });

  it("uses the local default when nothing is set", () => {
    expect(pickApiUrl("", undefined)).toBe(DEFAULT_API_URL);
  });

  it("strips trailing slashes", () => {
    expect(normalizeApiUrl(" https://a.example.com/// ")).toBe("https://a.example.com");
  });
});

describe("resolveBuildApiUrl", () => {
  it("accepts a set URL for any profile", () => {
    expect(resolveBuildApiUrl("https://api.example.com/", "production")).toBe(
      "https://api.example.com",
    );
  });

  it("falls back to localhost for local and development builds", () => {
    expect(resolveBuildApiUrl("", undefined)).toBe(DEFAULT_API_URL);
    expect(resolveBuildApiUrl(undefined, "development")).toBe(DEFAULT_API_URL);
  });

  it("fails clearly for a non-development build without a URL", () => {
    expect(() => resolveBuildApiUrl("", "production")).toThrow(
      /EXPO_PUBLIC_API_URL is not set for the "production" build/,
    );
    expect(() => resolveBuildApiUrl(undefined, "preview")).toThrow(/preview/);
  });

  it("knows development builds", () => {
    expect(isDevelopmentBuild(undefined)).toBe(true);
    expect(isDevelopmentBuild("development")).toBe(true);
    expect(isDevelopmentBuild("production")).toBe(false);
  });
});

describe("isApiTarget", () => {
  const api = "https://api.example.com";

  it("accepts relative API paths and the exact origin", () => {
    expect(isApiTarget("/v1/chat/photos/3", api)).toBe(true);
    expect(isApiTarget("https://api.example.com/v1/x", api)).toBe(true);
    expect(isApiTarget("https://API.example.com:443/v1/x", api)).toBe(true);
  });

  it("rejects lookalike hosts, other ports, schemes and protocol-relative URLs", () => {
    expect(isApiTarget("https://api.example.com.evil.io/x", api)).toBe(false);
    expect(isApiTarget("https://api.example.com@evil.io/x", api)).toBe(false);
    expect(isApiTarget("https://api.example.com:8443/x", api)).toBe(false);
    expect(isApiTarget("http://api.example.com/x", api)).toBe(false);
    expect(isApiTarget("//evil.io/x", api)).toBe(false);
    expect(isApiTarget("file:///tmp/a.jpg", api)).toBe(false);
  });
});
