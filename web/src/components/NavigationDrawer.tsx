import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { workspaceStore } from "@/store";
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
  }, [location.key]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="px-2">
          <UserAvatar className="shrink-0 w-6 h-6 rounded-md" avatarUrl={avatarUrl} />
          <span className="font-bold text-lg leading-10 text-ellipsis overflow-hidden text-foreground">{title}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 max-w-full overflow-auto px-2 bg-background">
        <SheetHeader>
          <SheetTitle />
        </SheetHeader>
        <Navigation className="pb-4" />
      </SheetContent>
    </Sheet>
  );
});

export default NavigationDrawer;
