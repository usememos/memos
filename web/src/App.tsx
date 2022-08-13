import { useEffect, useState } from "react";
import useI18n from "./hooks/useI18n";
import { appRouterSwitch } from "./routers";
import { globalService, locationService } from "./services";
import { useAppSelector } from "./store";
import * as storage from "./helpers/storage";

function App() {
  const { setLocale } = useI18n();
  const global = useAppSelector((state) => state.global);
  const pathname = useAppSelector((state) => state.location.pathname);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    locationService.updateStateWithLocation();
    window.onpopstate = () => {
      locationService.updateStateWithLocation();
    };
    globalService.initialState().then(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setLocale(global.locale);
    storage.set({
      locale: global.locale,
    });
  }, [global]);

  return <>{isLoading ? null : appRouterSwitch(pathname)}</>;
}

export default App;
