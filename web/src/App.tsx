import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RouterProvider } from "react-router-dom";
import { globalService, locationService } from "./services";
import { useAppSelector } from "./store";
import router from "./router";
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

  useEffect(() => {
    i18n.changeLanguage(global.locale);
    storage.set({
      locale: global.locale,
    });
  }, [global.locale]);

  return <RouterProvider router={router} />;
}

export default App;
