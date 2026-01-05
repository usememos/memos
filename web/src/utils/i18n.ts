import { FallbackLngObjList } from "i18next";
import { useTranslation } from "react-i18next";
import i18n, { locales, TLocale } from "@/i18n";
import enTranslation from "@/locales/en.json";

const LOCALE_STORAGE_KEY = "memos-locale";

const getStoredLocale = (): Locale | null => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored && locales.includes(stored) ? (stored as Locale) : null;
  } catch {
    return null;
  }
};

const setStoredLocale = (locale: Locale): void => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage might not be available
  }
};

export const findNearestMatchedLanguage = (language: string): Locale => {
  if (locales.includes(language as TLocale)) {
    return language as Locale;
  }

  const i18nFallbacks = Object.entries(i18n.store.options.fallbackLng as FallbackLngObjList);
  for (const [main, fallbacks] of i18nFallbacks) {
    if (language === main) {
      return fallbacks[0] as Locale;
    }
  }

  const shortCode = language.substring(0, 2);
  if (locales.includes(shortCode as TLocale)) {
    return shortCode as Locale;
  }

  // Try to match "xx-YY" to existing translation for "xx-ZZ" as a last resort
  // If some match is undesired, it can be overridden in src/i18n.ts `fallbacks` option
  for (const existing of locales) {
    if (shortCode == existing.substring(0, 2)) {
      return existing as Locale;
    }
  }

  // should be "en", so the selector is not empty if there isn't a translation for current user's language
  return (i18n.store.options.fallbackLng as FallbackLngObjList).default[0] as Locale;
};

type NestedKeyOf<T, K = keyof T> = K extends keyof T & (string | number)
  ? `${K}` | (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : never)
  : never;

// Represents the keys of nested translation objects.
export type Translations = NestedKeyOf<typeof enTranslation>;

// Represents a typed translation function.
type TypedT = (key: Translations, params?: Record<string, unknown>) => string;

export const useTranslate = (): TypedT => {
  const { t } = useTranslation<Translations>();
  return t;
};

export const isValidateLocale = (locale: string | undefined | null): boolean => {
  if (!locale) return false;
  return locales.includes(locale);
};

// Gets the locale to use with proper priority:
// 1. User setting (if logged in and has preference)
// 2. localStorage (from previous session)
// 3. Browser language preference
export const getLocaleWithFallback = (userLocale?: string): Locale => {
  // Priority 1: User setting (if logged in and valid)
  if (userLocale && isValidateLocale(userLocale)) {
    return userLocale as Locale;
  }

  // Priority 2: localStorage
  const stored = getStoredLocale();
  if (stored) {
    return stored;
  }

  // Priority 3: Browser language
  return findNearestMatchedLanguage(navigator.language);
};

// Applies and persists a locale setting
export const loadLocale = (locale: string): Locale => {
  const validLocale = isValidateLocale(locale) ? (locale as Locale) : findNearestMatchedLanguage(navigator.language);
  setStoredLocale(validLocale);
  i18n.changeLanguage(validLocale);
  return validLocale;
};

/**
 * Applies locale early during initial page load to prevent language flash.
 * Uses only localStorage and browser language (no user settings yet).
 */
export const applyLocaleEarly = (): void => {
  const stored = getStoredLocale();
  const locale = stored ?? findNearestMatchedLanguage(navigator.language);
  loadLocale(locale);
};

// Get the display name for a locale in its native language
export const getLocaleDisplayName = (locale: string): string => {
  try {
    const displayName = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
    if (displayName) {
      return displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }
  } catch {
    // Intl.DisplayNames might not be available or might fail for some locales
  }
  return locale;
};
