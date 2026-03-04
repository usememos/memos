import i18n, { BackendModule, FallbackLng, FallbackLngObjList } from "i18next";
import { orderBy } from "lodash-es";
import { initReactI18next } from "react-i18next";
import { findNearestMatchedLanguage } from "./utils/i18n";

export const locales = orderBy([
  "ar",
  "ca",
  "cs",
  "de",
  "en",
  "en-GB",
  "es",
  "fa",
  "fr",
  "gl",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ka-GE",
  "ko",
  "mr",
  "nb",
  "nl",
  "pl",
  "pt-PT",
  "pt-BR",
  "ru",
  "sl",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
  "zh-Hans",
  "zh-Hant",
]);

const fallbacks = {
  "zh-HK": ["zh-Hant", "en"],
  "zh-TW": ["zh-Hant", "en"],
  zh: ["zh-Hans", "en"],
} as FallbackLngObjList;

const resolveInitialLocale = (): string => {
  // 1) ?locale= query parameter
  try {
    const param = new URLSearchParams(window.location.search).get("locale");
    if (param) {
      if (locales.includes(param as (typeof locales)[number])) return param;
      const short = param.substring(0, 2);
      if (locales.includes(short as (typeof locales)[number])) return short;
    }
  } catch {
  }

  try {
    const stored = localStorage.getItem("memos-locale");
    if (stored && locales.includes(stored as (typeof locales)[number])) return stored;
  } catch {
  }

  try {
    const languages = navigator.languages ?? [navigator.language];
    for (const lang of languages) {
      if (locales.includes(lang as (typeof locales)[number])) return lang;
      const short = lang.substring(0, 2);
      if (locales.includes(short as (typeof locales)[number])) return short;
    }
  } catch {
  }

  return "en";
};

const LazyImportPlugin: BackendModule = {
  type: "backend",
  init: function () {},
  read: function (language, _, callback) {
    const matchedLanguage = findNearestMatchedLanguage(language);
    import(`./locales/${matchedLanguage}.json`)
      .then((translation: Record<string, unknown>) => {
        callback(null, translation);
      })
      .catch(() => {
      });
  },
};

i18n
  .use(LazyImportPlugin)
  .use(initReactI18next)
  .init({
    lng: resolveInitialLocale(),
    fallbackLng: {
      ...fallbacks,
      ...{ default: ["en"] },
    } as FallbackLng,
  });

export default i18n;
export type TLocale = (typeof locales)[number];