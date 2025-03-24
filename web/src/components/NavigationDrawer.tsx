import { Drawer } from "@mui/joy";
import { Button } from "@usememos/mui";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { workspaceStore } from "@/store/v2";
import Navigation from "./Navigation";
import UserAvatar from "./UserAvatar";

const NavigationDrawer = observer(() => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;
  const title = workspaceGeneralSetting.customProfile?.title || "Memos";
  const avatarUrl = workspaceGeneralSetting.customProfile?.logoUrl || "/full-logo.webp";

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
      <Button variant="plain" className="px-2" onClick={toggleDrawer(true)}>
        <UserAvatar className="shrink-0 w-6 h-6 rounded-md" avatarUrl={avatarUrl} />
        <span className="font-bold text-lg leading-10 ml-2 text-ellipsis shrink-0 cursor-pointer overflow-hidden text-gray-700 dark:text-gray-300">
          {title}
        </span>
      </Button>
      <Drawer anchor="left" size="sm" open={open} onClose={toggleDrawer(false)}>
        <div className="w-full h-full overflow-auto px-2 bg-zinc-100 dark:bg-zinc-900">
          <Navigation />
        </div>
      </Drawer>
    </>
  );
});

export default NavigationDrawer;
