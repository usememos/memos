import { useColorScheme } from "@mui/joy";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import { getSystemColorScheme } from "./helpers/utils";
import useNavigateTo from "./hooks/useNavigateTo";
import { userStore, workspaceStore } from "./store/v2";

const App = observer(() => {
  const { i18n } = useTranslation();
  const navigateTo = useNavigateTo();
  const { mode, setMode } = useColorScheme();
  const workspaceProfile = workspaceStore.state.profile;
  const userSetting = userStore.state.userSetting;
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;

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
    let currentAppearance = workspaceStore.state.appearance as Appearance;
    if (currentAppearance === "system") {
      currentAppearance = getSystemColorScheme();
    }
    setMode(currentAppearance);
  }, [workspaceStore.state.appearance]);

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

    workspaceStore.state.setPartial({
      locale: userSetting.locale || workspaceStore.state.locale,
      appearance: userSetting.appearance || workspaceStore.state.appearance,
    });
  }, [userSetting?.locale, userSetting?.appearance]);

  return <Outlet />;
});

export default App;
