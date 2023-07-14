import i18n, { TLocale, availableLocales } from "@/i18n";
import { FallbackLngObjList } from "i18next";
import { useTranslation } from "react-i18next";
import locales from "@/locales/en.json";
import type { NestedKeyOf } from "@/types/utils/nestedKeyOf.types";

export const findNearestLanguageMatch = (codename: string): Locale => {
  // Find existing translations for full codes (e.g. "en-US", "zh-Hant")
  if (codename.length > 2 && availableLocales.includes(codename as TLocale)) {
    return codename as Locale;
  }

  // Find fallback in src/i18n.ts
  const i18nfallbacks = Object.entries(i18n.store.options.fallbackLng as FallbackLngObjList);
  for (const [main, fallbacks] of i18nfallbacks) {
    if (codename === main) {
      return fallbacks[0] as Locale;
    }
  }

  const shortCode = codename.substring(0, 2);

  // Match existing short code translation
  if (availableLocales.includes(shortCode as TLocale)) {
    return shortCode as Locale;
  }

  // Try to match "xx-YY" to existing translation for "xx-ZZ" as a last resort
  // If some match is undesired, it can be overriden in src/i18n.ts `fallbacks` option
  for (const existing of availableLocales) {
    if (shortCode == existing.substring(0, 2)) {
      return existing as Locale;
    }
  }

  // should be "en", so the selector is not empty if there isn't a translation for current user's language
  return (i18n.store.options.fallbackLng as FallbackLngObjList).default[0] as Locale;
};

// Represents the keys of nested translation objects.
type Translations = NestedKeyOf<typeof locales>;

// Represents a typed translation function.
type TypedT = (key: Translations, params?: Record<string, any>) => string;

export const useTranslate = (): TypedT => {
  const { t } = useTranslation<Translations>();
  return t;
};
