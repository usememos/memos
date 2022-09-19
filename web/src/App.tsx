import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import useI18n from "./hooks/useI18n";
import { globalService, locationService } from "./services";
import { useAppSelector } from "./store";
import router from "./router";
import * as storage from "./helpers/storage";

function App() {
  const { setLocale } = useI18n();
  const global = useAppSelector((state) => state.global);

  useEffect(() => {
    locationService.updateStateWithLocation();
    window.onpopstate = () => {
      locationService.updateStateWithLocation();
    };

    globalService.initialState();
  }, []);

  useEffect(() => {
    setLocale(global.locale);
    storage.set({
      locale: global.locale,
    });
  }, [global.locale]);

  return <RouterProvider router={router} />;
}

export default App;
