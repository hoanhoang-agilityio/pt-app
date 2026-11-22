import { getLocales } from "expo-localization";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import { extraEn, extraVi, extraZh } from "./extra";
import vi from "./vi.json";
import zh from "./zh.json";

export const APP_LOCALES = ["vi", "en", "zh"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "vi";

export const isAppLocale = (value: unknown): value is AppLocale =>
  typeof value === "string" && (APP_LOCALES as readonly string[]).includes(value);

// Stored choice, else the device language when supported, else Vietnamese.
export const pickLocale = (
  stored: string | null | undefined,
  device: string | null | undefined,
): AppLocale => {
  if (isAppLocale(stored)) {
    return stored;
  }
  const code = device?.toLowerCase().split(/[-_]/)[0];

  return isAppLocale(code) ? code : DEFAULT_LOCALE;
};

export const deviceLanguage = () => getLocales()[0]?.languageCode ?? null;

const i18next = createInstance();

void i18next.use(initReactI18next).init({
  resources: {
    vi: { translation: { ...vi, ...extraVi } },
    en: { translation: { ...en, ...extraEn } },
    zh: { translation: { ...zh, ...extraZh } },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const setAppLocale = (locale: AppLocale) => i18next.changeLanguage(locale);
export const currentLocale = (): AppLocale =>
  isAppLocale(i18next.language) ? i18next.language : DEFAULT_LOCALE;

export { i18next };
