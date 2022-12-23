import { useColorScheme } from "@mui/joy";
import { useEffect, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-router-dom";
import router from "./router";
import { useLocationStore, useGlobalStore } from "./store/module";
import * as storage from "./helpers/storage";
import { getSystemColorScheme } from "./helpers/utils";
import Loading from "./pages/Loading";

const App = () => {
  const { i18n } = useTranslation();
  const globalStore = useGlobalStore();
  const locationStore = useLocationStore();
  const { mode, setMode } = useColorScheme();
  const { appearance, locale, systemStatus } = globalStore.state;

  useEffect(() => {
    locationStore.updateStateWithLocation();
    window.onpopstate = () => {
      locationStore.updateStateWithLocation();
    };
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

  // Inject additional style and script codes.
  useEffect(() => {
    if (systemStatus.additionalStyle) {
      const styleEl = document.createElement("style");
      styleEl.innerHTML = systemStatus.additionalStyle;
      styleEl.setAttribute("type", "text/css");
      document.body.insertAdjacentElement("beforeend", styleEl);
    }
    if (systemStatus.additionalScript) {
      const scriptEl = document.createElement("script");
      scriptEl.innerHTML = systemStatus.additionalScript;
      document.head.appendChild(scriptEl);
    }

    // dynamic update metadata with customized profile.
    document.title = systemStatus.customizedProfile.name;
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    link.href = systemStatus.customizedProfile.logoUrl || "/logo.png";
  }, [systemStatus]);

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

  return (
    <Suspense fallback={<Loading />}>
      <RouterProvider router={router} />
    </Suspense>
  );
};

export default App;
