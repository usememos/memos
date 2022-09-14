import { useEffect, useState } from "react";
import i18nStore from "./i18nStore";
import enLocale from "../../locales/en.json";
import zhLocale from "../../locales/zh.json";

const resources: Record<string, any> = {
  en: enLocale,
  zh: zhLocale,
};

const useI18n = () => {
  const [{ locale }, setState] = useState(i18nStore.getState());

  useEffect(() => {
    const unsubscribe = i18nStore.subscribe((ns) => {
      setState(ns);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const translate = (key: string): string => {
    const keys = key.split(".");
    let value = resources[locale];
    for (const k of keys) {
      if (value) {
        value = value[k];
      } else {
        return key;
      }
    }

    if (value) {
      return value;
    } else {
      return key;
    }
  };

  const setLocale = (locale: Locale) => {
    i18nStore.setState({
      locale,
    });
  };

  return {
    t: translate,
    locale,
    setLocale,
  };
};

export default useI18n;
