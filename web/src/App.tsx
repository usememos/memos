import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import useNavigateTo from "./hooks/useNavigateTo";
import { userStore, workspaceStore } from "./store";
import { loadTheme } from "./utils/theme";

const App = observer(() => {
  const { i18n } = useTranslation();
  const navigateTo = useNavigateTo();
  const workspaceProfile = workspaceStore.state.profile;
  const userGeneralSetting = userStore.state.userGeneralSetting;
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;

  // Redirect to sign up page if no instance owner.
  useEffect(() => {
    if (!workspaceProfile.owner) {
      navigateTo("/auth/signup");
    }
  }, [workspaceProfile.owner]);

  useEffect(() => {
    if (workspaceGeneralSetting.additionalStyle) {
      const styleEl = document.createElement("style");
      styleEl.innerHTML = workspaceGeneralSetting.additionalStyle;
      styleEl.setAttribute("type", "text/css");
      document.body.insertAdjacentElement("beforeend", styleEl);
    }
  }, [workspaceGeneralSetting.additionalStyle]);

  useEffect(() => {
    if (workspaceGeneralSetting.additionalScript) {
      const scriptEl = document.createElement("script");
      scriptEl.innerHTML = workspaceGeneralSetting.additionalScript;
      document.head.appendChild(scriptEl);
    }
  }, [workspaceGeneralSetting.additionalScript]);

  // Dynamic update metadata with customized profile.
  useEffect(() => {
    if (!workspaceGeneralSetting.customProfile) {
      return;
    }

    document.title = workspaceGeneralSetting.customProfile.title;
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    link.href = workspaceGeneralSetting.customProfile.logoUrl || "/logo.webp";
  }, [workspaceGeneralSetting.customProfile]);

  useEffect(() => {
    const currentLocale = workspaceStore.state.locale;
    // This will trigger re-rendering of the whole app.
    i18n.changeLanguage(currentLocale);
    document.documentElement.setAttribute("lang", currentLocale);
    if (["ar", "fa"].includes(currentLocale)) {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
    }
  }, [workspaceStore.state.locale]);

  useEffect(() => {
    if (!userGeneralSetting) {
      return;
    }

    workspaceStore.state.setPartial({
      locale: userGeneralSetting.locale || workspaceStore.state.locale,
      theme: userGeneralSetting.theme || workspaceStore.state.theme,
    });
  }, [userGeneralSetting?.locale, userGeneralSetting?.theme]);

  // Load theme when workspace theme changes or user setting changes
  useEffect(() => {
    const currentTheme = userGeneralSetting?.theme || workspaceStore.state.theme;
    if (currentTheme) {
      loadTheme(currentTheme);
    }
  }, [userGeneralSetting?.theme, workspaceStore.state.theme]);

  return <Outlet />;
});

export default App;
