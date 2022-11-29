import { CssVarsProvider } from "@mui/joy/styles";
import { useEffect, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-router-dom";
import { locationService } from "./services";
import { useAppSelector } from "./store";
import Loading from "./pages/Loading";
import router from "./router";
import * as storage from "./helpers/storage";
import theme from "./theme";

function App() {
  const { i18n } = useTranslation();
  const { locale, systemStatus } = useAppSelector((state) => state.global);

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

  return (
    <CssVarsProvider theme={theme}>
      <Suspense fallback={<Loading />}>
        <RouterProvider router={router} />
      </Suspense>
    </CssVarsProvider>
  );
}

export default App;
