// Pure helpers for the API base URL, shared by app.config.ts (build time) and
// src/lib/config.ts (runtime). No Expo imports so Vitest and the config loader
// can both use it.

export const DEFAULT_API_URL = "http://localhost:4000";

export const normalizeApiUrl = (url: string) => url.trim().replace(/\/+$/, "");

// EAS sets EAS_BUILD_PROFILE on every cloud build; unset means a local run.
export const isDevelopmentBuild = (profile: string | undefined) =>
  !profile || profile === "development";

// First non-empty candidate wins (`||`, so an empty variable falls through).
export const pickApiUrl = (...candidates: (string | undefined)[]) =>
  normalizeApiUrl(candidates.find((value) => value?.trim()) || DEFAULT_API_URL);

// Build-time resolution: a non-development build must not silently fall back
// to localhost.
export const resolveBuildApiUrl = (
  apiUrl: string | undefined,
  buildProfile: string | undefined,
) => {
  if (apiUrl?.trim()) {
    return normalizeApiUrl(apiUrl);
  }
  if (!isDevelopmentBuild(buildProfile)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL is not set for the "${buildProfile}" build. ` +
        "Set it in the EAS profile env (eas.json) or as an EAS environment variable.",
    );
  }
  return DEFAULT_API_URL;
};
