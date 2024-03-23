import { useColorScheme } from "@mui/joy";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import storage from "./helpers/storage";
import { getSystemColorScheme } from "./helpers/utils";
import useNavigateTo from "./hooks/useNavigateTo";
import { useGlobalStore } from "./store/module";
import { useUserStore, useWorkspaceSettingStore } from "./store/v1";
import { WorkspaceGeneralSetting, WorkspaceSettingKey } from "./types/proto/store/workspace_setting";

const App = () => {
  const { i18n } = useTranslation();
  const navigateTo = useNavigateTo();
  const { mode, setMode } = useColorScheme();
  const globalStore = useGlobalStore();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const userStore = useUserStore();
  const { appearance, locale, systemStatus, workspaceProfile } = globalStore.state;
  const userSetting = userStore.userSetting;
  const workspaceGeneralSetting =
    workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.WORKSPACE_SETTING_GENERAL).generalSetting ||
    WorkspaceGeneralSetting.fromPartial({});

  // Redirect to sign up page if no host.
  useEffect(() => {
    if (!workspaceProfile.owner) {
      navigateTo("/auth/signup");
    }
  }, [workspaceProfile.owner]);

  useEffect(() => {
    const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      if (globalStore.getState().appearance === "system") {
        const mode = e.matches ? "dark" : "light";
        setMode(mode);
      }
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
    document.title = systemStatus.customizedProfile.name;
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    link.href = systemStatus.customizedProfile.logoUrl || "/logo.webp";
  }, [systemStatus.customizedProfile]);

  useEffect(() => {
    if (!userSetting) {
      return;
    }

    globalStore.setLocale(userSetting.locale);
    globalStore.setAppearance(userSetting.appearance as Appearance);
  }, [userSetting?.locale, userSetting?.appearance]);

  useEffect(() => {
    const { locale: storageLocale } = storage.get(["locale"]);
    const currentLocale = storageLocale || locale;
    i18n.changeLanguage(currentLocale);
    document.documentElement.setAttribute("lang", currentLocale);
    if (currentLocale === "ar") {
      document.documentElement.setAttribute("dir", "rtl");
    } else {
      document.documentElement.setAttribute("dir", "ltr");
    }
    storage.set({
      locale: currentLocale,
    });
  }, [locale]);

  useEffect(() => {
    const { appearance: storageAppearance } = storage.get(["appearance"]);
    let currentAppearance = (storageAppearance || appearance) as Appearance;
    if (currentAppearance === "system") {
      currentAppearance = getSystemColorScheme();
    }
    setMode(currentAppearance);
    storage.set({
      appearance: currentAppearance,
    });
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") {
      root.classList.remove("dark");
    } else if (mode === "dark") {
      root.classList.add("dark");
    }
  }, [mode]);

  return <Outlet />;
};

export default App;
