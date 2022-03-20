import Memos from "../pages/Memos";
import Trash from "../pages/Trash";
import Setting from "../pages/Setting";

const homeRouter = {
  "/trash": <Trash />,
  "/setting": <Setting />,
  "*": <Memos />,
};

export default homeRouter;
