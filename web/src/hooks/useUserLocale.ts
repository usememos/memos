import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getLocaleDirection, getLocaleWithFallback, type LocaleDirection, loadLocale, subscribeToLocaleDirection } from "@/utils/i18n";

/**
 * Hook that reactively applies user locale preference.
 * Priority: User setting → localStorage → browser language
 */
export const useUserLocale = () => {
  const { userGeneralSetting } = useAuth();
  const direction = useSyncExternalStore<LocaleDirection>(subscribeToLocaleDirection, getLocaleDirection, () => "ltr");

  // Apply locale when user setting changes or user logs in
  useEffect(() => {
    if (!userGeneralSetting) {
      return;
    }
    const locale = getLocaleWithFallback(userGeneralSetting.locale);
    loadLocale(locale);
  }, [userGeneralSetting?.locale]);

  return direction;
};
