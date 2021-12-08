import Home from "../pages/Home";
import Signin from "../pages/Signin";

const appRouter = {
  "/signin": <Signin />,
  "*": <Home />,
};

export default appRouter;
