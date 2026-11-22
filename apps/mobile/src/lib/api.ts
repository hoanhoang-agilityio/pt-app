import { createApiClient } from "./api-client";
import { API_URL, APP_VERSION } from "./config";

// The app-wide API client. The session token is held in memory (loaded from
// SecureStore at launch by the auth provider) and sent as Bearer.

let token: string | null = null;
let onSessionEnded: (() => void) | null = null;

export const setSessionToken = (value: string | null) => {
  token = value;
};
export const getSessionToken = () => token;
export const setSessionEndedHandler = (handler: (() => void) | null) => {
  onSessionEnded = handler;
};

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => token,
  onSessionEnded: () => onSessionEnded?.(),
  headers: { "x-client-version": APP_VERSION },
});

// Headers expo-image needs for an authenticated file URL.
export const authHeaders = (): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};
