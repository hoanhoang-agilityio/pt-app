import * as SecureStore from "expo-secure-store";

// The opaque session token lives in the device keychain / keystore only.
const TOKEN_KEY = "pt.session.token";
const LOCALE_KEY = "pt.locale";
const PUSH_TOKEN_KEY = "pt.push.token";

const safeGet = async (key: string) => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const safeSet = async (key: string, value: string | null) => {
  try {
    if (value === null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    // Keychain unavailable: the app keeps working for this launch.
  }
};

export const readToken = () => safeGet(TOKEN_KEY);
export const writeToken = (token: string | null) => safeSet(TOKEN_KEY, token);
export const readLocale = () => safeGet(LOCALE_KEY);
export const writeLocale = (locale: string | null) => safeSet(LOCALE_KEY, locale);
export const readPushToken = () => safeGet(PUSH_TOKEN_KEY);
export const writePushToken = (token: string | null) =>
  safeSet(PUSH_TOKEN_KEY, token);
