import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { StatisticsData } from "@/types/statistics";
import MemoExplorer, { MemoExplorerContext, MemoExplorerFeatures } from "./MemoExplorer";

interface Props {
  context?: MemoExplorerContext;
  features?: MemoExplorerFeatures;
  statisticsData: StatisticsData;
  tagCount: Record<string, number>;
  onOpenChange?: (open: boolean) => void;
}

const MemoExplorerDrawer = (props: Props) => {
  const { context, features, statisticsData, tagCount, onOpenChange } = props;
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    onOpenChange?.(false);
  }, [location.pathname, onOpenChange]);

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
    >
      <SheetTrigger render={<Button variant="ghost" />}>
        <MenuIcon className="size-5 text-foreground" />
      </SheetTrigger>
      <SheetContent side="right" className="w-80 max-w-full bg-background">
        <SheetHeader>
          <SheetTitle />
        </SheetHeader>
        <MemoExplorer className="px-4" context={context} features={features} statisticsData={statisticsData} tagCount={tagCount} />
      </SheetContent>
    </Sheet>
  );
};

export default MemoExplorerDrawer;
