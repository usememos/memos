import { GanttChartIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import MemoDetailSidebar from "./MemoDetailSidebar";

interface Props {
  memo: Memo;
  parentPage?: string;
}

const MemoDetailSidebarDrawer = ({ memo, parentPage }: Props) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2">
          <GanttChartIcon className="w-5 h-auto text-muted-foreground" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-80 px-4 bg-background">
        <MemoDetailSidebar className="py-4" memo={memo} parentPage={parentPage} />
      </SheetContent>
    </Sheet>
  );
};

export default MemoDetailSidebarDrawer;
