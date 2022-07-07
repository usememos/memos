import { appRouterSwitch } from "./routers";
import { useAppSelector } from "./store";

function App() {
  const pathname = useAppSelector((state) => state.location.pathname);

  return <>{appRouterSwitch(pathname)}</>;
}

export default App;
