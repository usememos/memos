import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import useNavigateTo from "./hooks/useNavigateTo";
import { instanceStore, userStore } from "./store";
import { cleanupExpiredOAuthState } from "./utils/oauth";
import { getThemeWithFallback, loadTheme, setupSystemThemeListener } from "./utils/theme";

const App = observer(() => {
  const { i18n } = useTranslation();
  const navigateTo = useNavigateTo();
  const instanceProfile = instanceStore.state.profile;
  const userGeneralSetting = userStore.state.userGeneralSetting;
  const instanceGeneralSetting = instanceStore.state.generalSetting;

  // Clean up expired OAuth states on app initialization
  useEffect(() => {
    cleanupExpiredOAuthState();
  }, []);

  // Redirect to sign up page if no instance owner.
  useEffect(() => {
    if (!instanceProfile.owner) {
      navigateTo("/auth/signup");
    }
  }, [instanceProfile.owner]);

  useEffect(() => {
    if (instanceGeneralSetting.additionalStyle) {
      const styleEl = document.createElement("style");
      styleEl.innerHTML = instanceGeneralSetting.additionalStyle;
      styleEl.setAttribute("type", "text/css");
      document.body.insertAdjacentElement("beforeend", styleEl);
    }
  }, [instanceGeneralSetting.additionalStyle]);

  useEffect(() => {
    if (instanceGeneralSetting.additionalScript) {
      const scriptEl = document.createElement("script");
      scriptEl.innerHTML = instanceGeneralSetting.additionalScript;
      document.head.appendChild(scriptEl);
    }
  }, [instanceGeneralSetting.additionalScript]);

  // Dynamic update metadata with customized profile.
  useEffect(() => {
    if (!instanceGeneralSetting.customProfile) {
      return;
    }

    document.title = instanceGeneralSetting.customProfile.title;
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    link.href = instanceGeneralSetting.customProfile.logoUrl || "/logo.webp";
  }, [instanceGeneralSetting.customProfile]);

  // Update HTML lang and dir attributes based on current locale
  useEffect(() => {
    const currentLocale = i18n.language;
    document.documentElement.setAttribute("lang", currentLocale);
    if (["ar", "fa"].includes(currentLocale)) {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
    }
  }, [i18n.language]);

  // Apply theme when user setting changes
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
      // Reload theme when system preference changes
      loadTheme(theme);
    });

    // Cleanup listener on unmount or when theme changes
    return cleanup;
  }, [userGeneralSetting?.theme]);

  return <Outlet />;
});

export default App;
