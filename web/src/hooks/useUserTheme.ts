import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getThemeWithFallback, loadTheme, setupSystemThemeListener } from "@/utils/theme";

/**
 * Hook that reactively applies user theme preference.
 * Priority: User setting → localStorage → system preference
 */
export const useUserTheme = () => {
  const { userGeneralSetting } = useAuth();

  // Apply theme when user setting changes or user logs in
  useEffect(() => {
    if (!userGeneralSetting) {
      return;
    }
    const theme = getThemeWithFallback(userGeneralSetting.theme);
    loadTheme(theme);
  }, [userGeneralSetting?.theme]);

  // Read the latest preference on each change, including local-only guest choices.
  useEffect(() => {
    return setupSystemThemeListener(() => {
      if (getThemeWithFallback(userGeneralSetting?.theme) === "system") {
        loadTheme("system");
      }
    });
  }, [userGeneralSetting?.theme]);
};
