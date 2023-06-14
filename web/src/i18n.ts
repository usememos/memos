import i18n, { FallbackLng, FallbackLngObjList } from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import toast from "react-hot-toast";

export const availableLocales = [
  "de",
  "en",
  "es",
  "fr",
  "hr",
  "it",
  "ja",
  "ko",
  "nl",
  "pl",
  "pt-BR",
  "ru",
  "sl",
  "sv",
  "tr",
  "uk",
  "vi",
  "zh-Hans",
  "zh-Hant",
] as const;

const fallbacks = {
  "zh-HK": ["zh-Hant", "en"],
  "zh-TW": ["zh-Hant", "en"],
  zh: ["zh-Hans", "en"],
} as FallbackLngObjList;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    detection: {
      order: ["navigator"],
    },
    fallbackLng: {
      ...fallbacks,
      ...{ default: ["en"] },
    } as FallbackLng,
  });

for (const locale of availableLocales) {
  import(`./locales/${locale}.json`)
    .then((translation) => {
      i18n.addResourceBundle(locale, "translation", translation.default, true, true);
    })
    .catch((err) => {
      toast.error(`Failed to load locale "${locale}".\n${err}`, { duration: 5000 });
    });
}

export default i18n;
export type TLocale = typeof availableLocales[number];
