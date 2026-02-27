import i18n, { TLocale, locales } from "@/i18n";
import enTranslation from "@/locales/en.json";
import { FallbackLngObjList } from "i18next";
import { useTranslation } from "react-i18next";

const LOCALE_STORAGE_KEY = "memos-locale";
const LOCALE_QUERY_PARAM = "locale";

type Locale = TLocale;

const getStoredLocale = (): Locale | null => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored && locales.includes(stored as TLocale) ? (stored as Locale) : null;
  } catch {
    return null;
  }
};

const setStoredLocale = (locale: Locale): void => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
  }
};

export const normalizeLocale = (tag: string): Locale | null => {
  if (!tag) return null;

  if (locales.includes(tag as TLocale)) {
    return tag as Locale;
  }

  const i18nFallbacks = Object.entries(i18n.store?.options?.fallbackLng as FallbackLngObjList ?? {});
  for (const [main, mapped] of i18nFallbacks) {
    if (tag === main && mapped.length > 0) {
      return mapped[0] as Locale;
    }
  }

  const shortCode = tag.substring(0, 2);
  if (locales.includes(shortCode as TLocale)) {
    return shortCode as Locale;
  }

  for (const existing of locales) {
    if (shortCode === existing.substring(0, 2)) {
      return existing as Locale;
    }
  }

  return null;
};

export const findNearestMatchedLanguage = (language: string): Locale => {
  return normalizeLocale(language) ?? ("en" as Locale);
};

type NestedKeyOf<T, K = keyof T> = K extends keyof T & (string | number)
  ? `${K}` | (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : never)
  : never;

export type Translations = NestedKeyOf<typeof enTranslation>;

type TypedT = (key: Translations, params?: Record<string, unknown>) => string;

export const useTranslate = (): TypedT => {
  const { t } = useTranslation<Translations>();
  return t;
};

export const isValidateLocale = (locale: string | undefined | null): boolean => {
  if (!locale) return false;
  return locales.includes(locale as TLocale);
};


const getQueryParamLocale = (): Locale | null => {
  try {
    const param = new URLSearchParams(window.location.search).get(LOCALE_QUERY_PARAM);
    return param ? normalizeLocale(param) : null;
  } catch {
    return null;
  }
};


const getBrowserLocale = (): Locale => {
  try {
    const languages = navigator.languages ?? [navigator.language];
    for (const lang of languages) {
      const normalized = normalizeLocale(lang);
      if (normalized) return normalized;
    }
  } catch {
  }
  return "en" as Locale;
};

/**
 * Gets the locale to use with proper priority:
 *   1. ?locale= query param
 *   2. User setting (if logged in and has preference)
 *   3. localStorage (from previous session)
 *   4. Browser language preferences (navigator.languages)
 *   5. Fallback "en"
 */
export const getLocaleWithFallback = (userLocale?: string): Locale => {
  const queryLocale = getQueryParamLocale();
  if (queryLocale) return queryLocale;

  if (userLocale && isValidateLocale(userLocale)) {
    return userLocale as Locale;
  }

  const stored = getStoredLocale();
  if (stored) return stored;

  return getBrowserLocale();
};

export const loadLocale = (locale: string): Locale => {
  const validLocale = isValidateLocale(locale) ? (locale as Locale) : getBrowserLocale();
  setStoredLocale(validLocale);
  i18n.changeLanguage(validLocale);
  return validLocale;
};


export const applyLocaleEarly = (): void => {
  const stored = getStoredLocale();
  const locale = stored ?? getBrowserLocale();
  loadLocale(locale);
};

export const getLocaleDisplayName = (locale: string): string => {
  try {
    const displayName = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
    if (displayName) {
      return displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }
  } catch {
    
  }
  return locale;
};