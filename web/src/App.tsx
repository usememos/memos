import { useColorScheme } from "@mui/joy";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import storage from "./helpers/storage";
import { getSystemColorScheme } from "./helpers/utils";
import Loading from "./pages/Loading";
import { initialGlobalState, initialUserState, useGlobalStore } from "./store/module";
import { useUserV1Store } from "./store/v1";

const App = () => {
  const { i18n } = useTranslation();
  const globalStore = useGlobalStore();
  const { mode, setMode } = useColorScheme();
  const userV1Store = useUserV1Store();
  const [loading, setLoading] = useState(true);
  const { appearance, locale, systemStatus } = globalStore.state;

  useEffect(() => {
    const initialState = async () => {
      try {
        await initialGlobalState();
      } catch (error) {
        // do nothing
      }

      try {
        const user = await initialUserState();
        if (user) {
          await userV1Store.getOrFetchUserByUsername(user.username);
        }
      } catch (error) {
        // do nothing.
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

  useEffect(() => {
    // dynamic update metadata with customized profile.
    document.title = systemStatus.customizedProfile.name;
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    link.href = systemStatus.customizedProfile.logoUrl || "/logo.webp";
  }, [systemStatus.customizedProfile]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", locale);
    i18n.changeLanguage(locale);
    storage.set({
      locale: locale,
    });
  }, [locale]);

  useEffect(() => {
    storage.set({
      appearance: appearance,
    });

    let currentAppearance = appearance;
    if (appearance === "system") {
      currentAppearance = getSystemColorScheme();
    }

    setMode(currentAppearance);
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") {
      root.classList.remove("dark");
    } else if (mode === "dark") {
      root.classList.add("dark");
    }
  }, [mode]);

  return loading ? (
    <Loading />
  ) : (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  );
};

export default App;
