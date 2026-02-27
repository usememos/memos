import { useAuth } from "@/contexts/AuthContext";
import { getLocaleWithFallback, loadLocale } from "@/utils/i18n";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export const useUserLocale = () => {
  const { i18n } = useTranslation();
  const { userGeneralSetting } = useAuth();

  useEffect(() => {
    const locale = getLocaleWithFallback(userGeneralSetting?.locale);
    loadLocale(locale);
  }, [userGeneralSetting?.locale]);

  useEffect(() => {
    const currentLocale = i18n.language;
    document.documentElement.setAttribute("lang", currentLocale);

    if (["ar", "fa"].includes(currentLocale)) {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
    }
  }, [i18n.language]);
};