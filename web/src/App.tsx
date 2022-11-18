import { CssVarsProvider } from "@mui/joy/styles";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-router-dom";
import { globalService, locationService } from "./services";
import { useAppSelector } from "./store";
import router from "./router";
import * as api from "./helpers/api";
import * as storage from "./helpers/storage";

function App() {
  const { i18n } = useTranslation();
  const global = useAppSelector((state) => state.global);

  useEffect(() => {
    locationService.updateStateWithLocation();
    window.onpopstate = () => {
      locationService.updateStateWithLocation();
    };

    globalService.initialState();
  }, []);

  // Inject additional style and script codes.
  useEffect(() => {
    api.getSystemStatus().then(({ data }) => {
      const { data: status } = data;
      if (status.additionalStyle) {
        const styleEl = document.createElement("style");
        styleEl.innerHTML = status.additionalStyle;
        styleEl.setAttribute("type", "text/css");
        document.head.appendChild(styleEl);
      }
      if (status.additionalScript) {
        const scriptEl = document.createElement("script");
        scriptEl.innerHTML = status.additionalScript;
        document.head.appendChild(scriptEl);
      }
    });
  }, []);

  useEffect(() => {
    i18n.changeLanguage(global.locale);
    storage.set({
      locale: global.locale,
    });
  }, [global.locale]);

  return (
    <CssVarsProvider>
      <RouterProvider router={router} />
    </CssVarsProvider>
  );
}

export default App;
