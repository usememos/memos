import { useColorScheme } from "@mui/joy";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import useLocalStorage from "react-use/lib/useLocalStorage";
import { getSystemColorScheme } from "./helpers/utils";
import useNavigateTo from "./hooks/useNavigateTo";
import { useCommonContext } from "./layouts/CommonContextProvider";
import { useUserStore, useWorkspaceSettingStore } from "./store/v1";
import { WorkspaceGeneralSetting, WorkspaceSettingKey } from "./types/proto/store/workspace_setting";

const App = () => {
  const { i18n } = useTranslation();
  const navigateTo = useNavigateTo();
  const { mode, setMode } = useColorScheme();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const userStore = useUserStore();
  const commonContext = useCommonContext();
  const [, setLocale] = useLocalStorage("locale", "en");
  const [, setAppearance] = useLocalStorage("appearance", "system");
  const workspaceProfile = commonContext.profile;
  const userSetting = userStore.userSetting;

  const workspaceGeneralSetting =
    workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.GENERAL).generalSetting || WorkspaceGeneralSetting.fromPartial({});

  // Redirect to sign up page if no instance owner.
  useEffect(() => {
    if (!workspaceProfile.owner) {
      navigateTo("/auth/signup");
    }
  }, [workspaceProfile.owner]);

  useEffect(() => {
    const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      const mode = e.matches ? "dark" : "light";
      setMode(mode);
    };

    try {
      if (darkMediaQuery.addEventListener) {
        darkMediaQuery.addEventListener("change", handleColorSchemeChange);
      } else {
        darkMediaQuery.addListener(handleColorSchemeChange);
      }
    } catch (error) {
      console.error("failed to initial color scheme listener", error);
    }
  }, []);

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
    const currentLocale = commonContext.locale;
    i18n.changeLanguage(currentLocale);
    document.documentElement.setAttribute("lang", currentLocale);
    if (currentLocale === "ar") {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
    }
    setLocale(currentLocale);
  }, [commonContext.locale]);

  useEffect(() => {
    let currentAppearance = commonContext.appearance as Appearance;
    if (currentAppearance === "system") {
      currentAppearance = getSystemColorScheme();
    }
    setMode(currentAppearance);
    setAppearance(currentAppearance);
  }, [commonContext.appearance]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") {
      root.classList.remove("dark");
    } else if (mode === "dark") {
      root.classList.add("dark");
    }
  }, [mode]);

  useEffect(() => {
    if (!userSetting) {
      return;
    }

    commonContext.setLocale(userSetting.locale);
    commonContext.setAppearance(userSetting.appearance);
  }, [userSetting?.locale, userSetting?.appearance]);

  return <Outlet />;
};

export default App;
