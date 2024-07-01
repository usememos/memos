import { Drawer, IconButton } from "@mui/joy";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Icon from "../Icon";
import ExploreSidebar from "./ExploreSidebar";

const ExploreSidebarDrawer = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const toggleDrawer = (inOpen: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (event.type === "keydown" && ((event as React.KeyboardEvent).key === "Tab" || (event as React.KeyboardEvent).key === "Shift")) {
      return;
    }

    setOpen(inOpen);
  };

  return (
    <>
      <IconButton onClick={toggleDrawer(true)}>
        <Icon.Search className="w-5 h-auto dark:text-gray-400" />
      </IconButton>
      <Drawer anchor="right" size="sm" open={open} onClose={toggleDrawer(false)}>
        <div className="w-full h-full px-4 bg-zinc-100 dark:bg-zinc-900">
          <ExploreSidebar className="py-4" />
        </div>
      </Drawer>
    </>
  );
};

export default ExploreSidebarDrawer;
