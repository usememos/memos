import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import HomeSidebar from "./HomeSidebar";

const HomeSidebarDrawer = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="bg-transparent! px-2">
          <MenuIcon className="w-6 h-auto text-foreground" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-80 bg-secondary">
        <HomeSidebar className="px-4 py-4" />
      </SheetContent>
    </Sheet>
  );
};

export default HomeSidebarDrawer;
