import { useContext, useEffect } from "react";
import { locationService, userService } from "../services";
import { homeRouterSwitch } from "../routers";
import appContext from "../stores/appContext";
import Sidebar from "../components/Sidebar";
import useLoading from "../hooks/useLoading";
import "../less/home.less";

function Home() {
  const {
    locationState: { pathname },
  } = useContext(appContext);
  const loadingState = useLoading();

  useEffect(() => {
    const { user } = userService.getState();
    if (!user) {
      userService
        .doSignIn()
        .catch(() => {
          // do nth
        })
        .finally(() => {
          if (userService.getState().user) {
            loadingState.setFinish();
          } else {
            locationService.replaceHistory("/signin");
          }
        });
    } else {
      loadingState.setFinish();
    }
  }, []);

  return (
    <>
      {loadingState.isLoading ? null : (
        <section id="page-wrapper">
          <Sidebar />
          <main className="content-wrapper">{homeRouterSwitch(pathname)}</main>
        </section>
      )}
    </>
  );
}

export default Home;
