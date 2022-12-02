import { useEffect, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-router-dom";
import { locationService } from "./services";
import { useAppSelector } from "./store";
import Loading from "./pages/Loading";
import router from "./router";
import * as storage from "./helpers/storage";
import { useColorScheme } from "@mui/joy";

function App() {
  const { i18n } = useTranslation();
  const { appearance, locale, systemStatus } = useAppSelector((state) => state.global);
  const { setMode } = useColorScheme();

  useEffect(() => {
    locationService.updateStateWithLocation();
    window.onpopstate = () => {
      locationService.updateStateWithLocation();
    };
  }, []);

  // Inject additional style and script codes.
  useEffect(() => {
    if (systemStatus.additionalStyle) {
      const styleEl = document.createElement("style");
      styleEl.innerHTML = systemStatus.additionalStyle;
      styleEl.setAttribute("type", "text/css");
      document.head.appendChild(styleEl);
    }
    if (systemStatus.additionalScript) {
      const scriptEl = document.createElement("script");
      scriptEl.innerHTML = systemStatus.additionalScript;
      document.head.appendChild(scriptEl);
    }
  }, [systemStatus]);

  useEffect(() => {
    i18n.changeLanguage(locale);
    storage.set({
      locale: locale,
    });
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    if (appearance === "light") {
      root.classList.remove("dark");
    } else if (appearance === "dark") {
      root.classList.add("dark");
    }
    setMode(appearance);
    storage.set({
      appearance: appearance,
    });
  }, [appearance]);

  return (
    <Suspense fallback={<Loading />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

export default App;
