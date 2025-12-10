import { useEffect } from "react";
import { userStore } from "@/store";
import { getThemeWithFallback, loadTheme, setupSystemThemeListener } from "@/utils/theme";

/**
 * Hook that reactively applies user theme preference.
 * Priority: User setting → localStorage → system preference
 */
export const useUserTheme = () => {
  const userGeneralSetting = userStore.state.userGeneralSetting;

  // Apply theme when user setting changes or user logs in
  useEffect(() => {
    if (!userGeneralSetting) {
      return;
    }
    const theme = getThemeWithFallback(userGeneralSetting.theme);
    loadTheme(theme);
  }, [userGeneralSetting?.theme]);

  // Listen for system theme changes when using "system" theme
  useEffect(() => {
    const theme = getThemeWithFallback(userGeneralSetting?.theme);

    // Only set up listener if theme is "system"
    if (theme !== "system") {
      return;
    }

    // Set up listener for OS theme preference changes
    const cleanup = setupSystemThemeListener(() => {
      loadTheme(theme);
    });

    return cleanup;
  }, [userGeneralSetting?.theme]);
};
