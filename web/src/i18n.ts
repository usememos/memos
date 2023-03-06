import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enLocale from "./locales/en.json";
import zhLocale from "./locales/zh.json";
import viLocale from "./locales/vi.json";
import frLocale from "./locales/fr.json";
import nlLocale from "./locales/nl.json";
import svLocale from "./locales/sv.json";
import deLocale from "./locales/de.json";
import esLocale from "./locales/es.json";
import ukLocale from "./locales/uk.json";
import ruLocale from "./locales/ru.json";
import itLocale from "./locales/it.json";
import hantLocale from "./locales/zh-Hant.json";
import trLocale from "./locales/tr.json";
import koLocale from "./locales/ko.json";

const DETECTION_OPTIONS = {
  order: ["navigator"],
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    detection: DETECTION_OPTIONS,
    resources: {
      en: {
        translation: enLocale,
      },
      zh: {
        translation: zhLocale,
      },
      vi: {
        translation: viLocale,
      },
      fr: {
        translation: frLocale,
      },
      nl: {
        translation: nlLocale,
      },
      sv: {
        translation: svLocale,
      },
      de: {
        translation: deLocale,
      },
      es: {
        translation: esLocale,
      },
      uk: {
        translation: ukLocale,
      },
      ru: {
        translation: ruLocale,
      },
      it: {
        translation: itLocale,
      },
      hant: {
        translation: hantLocale,
      },
      tr: {
        translation: trLocale,
      },
      ko: {
        translation: koLocale,
      },
    },
    fallbackLng: "en",
  });

export default i18n;
