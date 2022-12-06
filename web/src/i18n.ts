import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enLocale from "./locales/en.json";
import zhLocale from "./locales/zh.json";
import viLocale from "./locales/vi.json";
import frLocale from "./locales/fr.json";
import nlLocale from "./locales/nl.json";
import svLocale from "./locales/sv.json";
import deLocale from "./locales/de.json";

i18n.use(initReactI18next).init({
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
  },
  lng: "nl",
  fallbackLng: "en",
});

export default i18n;
