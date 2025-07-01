import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="px-2">
          <UserAvatar className="shrink-0 w-6 h-6 rounded-md" avatarUrl={avatarUrl} />
          <span className="font-bold text-lg leading-10 ml-2 text-ellipsis shrink-0 cursor-pointer overflow-hidden text-gray-700 dark:text-gray-300">
            {title}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:w-80 overflow-auto px-2 bg-zinc-100 dark:bg-zinc-900">
        <Navigation />
      </SheetContent>
    </Sheet>
  );
});

export default NavigationDrawer;
