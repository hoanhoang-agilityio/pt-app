import Constants from "expo-constants";

import { pickApiUrl } from "./api-url";

// API base URL: app.config.ts reads EXPO_PUBLIC_API_URL into `extra.apiUrl`;
// the env var itself is also inlined by Metro. Default is the local API.
const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)
  ?.apiUrl;

// `||` semantics: an empty EXPO_PUBLIC_API_URL falls back to the next source.
export const API_URL = pickApiUrl(process.env.EXPO_PUBLIC_API_URL, fromExtra);

export const EAS_PROJECT_ID: string | undefined =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  (
    Constants.expoConfig?.extra as
      | { eas?: { projectId?: string } }
      | undefined
  )?.eas?.projectId ||
  Constants.easConfig?.projectId ||
  undefined;

export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";
