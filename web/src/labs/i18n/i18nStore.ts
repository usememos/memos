import createI18nStore from "./createI18nStore";

const defaultI18nState = {
  locale: "en",
};

const i18nStore = createI18nStore(defaultI18nState);

export default i18nStore;
