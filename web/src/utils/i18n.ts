import { FallbackLngObjList } from "i18next";
import { useTranslation } from "react-i18next";
import i18n, { locales, TLocale } from "@/i18n";
import enTranslation from "@/locales/en.json";

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
type TypedT = (key: Translations, params?: Record<string, any>) => string;

export const useTranslate = (): TypedT => {
  const { t } = useTranslation<Translations>();
  return t;
};
