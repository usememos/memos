import { useEffect, useState } from "react";
import { appRouterSwitch } from "./routers";
import { locationService } from "./services";
import { useAppSelector } from "./store";

function App() {
  const pathname = useAppSelector((state) => state.location.pathname);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    locationService.updateStateWithLocation();
    window.onpopstate = () => {
      locationService.updateStateWithLocation();
    };
    setLoading(false);
  }, []);

  return <>{isLoading ? null : appRouterSwitch(pathname)}</>;
}

export default App;
