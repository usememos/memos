import Home from "../pages/Home";
import Auth from "../pages/Auth";

const appRouter = {
  "/auth": <Auth />,
  "*": <Home />,
};

export default appRouter;
