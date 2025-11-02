import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import MemoExplorer from "./MemoExplorer";

const MemoExplorerDrawer = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost">
          <MenuIcon className="size-5 text-foreground" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 max-w-full bg-background">
        <SheetHeader>
          <SheetTitle />
        </SheetHeader>
        <MemoExplorer className="px-4" />
      </SheetContent>
    </Sheet>
  );
};

export default MemoExplorerDrawer;
