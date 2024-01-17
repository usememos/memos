import { useColorScheme } from "@mui/joy";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import storage from "./helpers/storage";
import { getSystemColorScheme } from "./helpers/utils";
import useNavigateTo from "./hooks/useNavigateTo";
import { useGlobalStore } from "./store/module";
import { useUserStore } from "./store/v1";

const App = () => {
  const { i18n } = useTranslation();
  const navigateTo = useNavigateTo();
  const { mode, setMode } = useColorScheme();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const [loading, setLoading] = useState(true);
  const { appearance, locale, systemStatus } = globalStore.state;
  const userSetting = userStore.userSetting;

  // Redirect to sign up page if no host.
  useEffect(() => {
    if (!systemStatus.host) {
      navigateTo("/auth/signup");
    }
  }, [systemStatus.host]);

  useEffect(() => {
    const initialState = async () => {
      try {
        await userStore.fetchCurrentUser();
      } catch (error) {
        // Do nothing.
      }
      setLoading(false);
    };

    initialState();
  }, []);

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
    if (systemStatus.additionalStyle) {
      const styleEl = document.createElement("style");
      styleEl.innerHTML = systemStatus.additionalStyle;
      styleEl.setAttribute("type", "text/css");
      document.body.insertAdjacentElement("beforeend", styleEl);
    }
  }, [systemStatus.additionalStyle]);

  useEffect(() => {
    if (systemStatus.additionalScript) {
      const scriptEl = document.createElement("script");
      scriptEl.innerHTML = systemStatus.additionalScript;
      document.head.appendChild(scriptEl);
    }
  }, [systemStatus.additionalScript]);

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

  return loading ? null : <Outlet />;
};

export default App;
