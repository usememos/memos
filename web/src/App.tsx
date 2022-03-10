import { useContext } from "react";
import appContext from "./stores/appContext";
import { appRouterSwitch } from "./routers";
import "./less/app.less";

function App() {
  const {
    locationState: { pathname },
  } = useContext(appContext);

  return <>{appRouterSwitch(pathname)}</>;
}

export default App;
