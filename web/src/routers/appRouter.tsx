import Home from "../pages/Home";
import Auth from "../pages/Auth";
import Explore from "../pages/Explore";

const appRouter = {
  "/auth": <Auth />,
  "/explore": <Explore />,
  "*": <Home />,
};

export default appRouter;
