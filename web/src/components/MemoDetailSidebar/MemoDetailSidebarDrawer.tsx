import { GanttChartIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Memo } from "@/types/proto/api/v1/memo_service";
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
        <Button variant="ghost" className="bg-transparent! px-2">
          <GanttChartIcon className="w-5 h-auto dark:text-gray-400" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-80 px-4 bg-zinc-100 dark:bg-zinc-900">
        <MemoDetailSidebar className="py-4" memo={memo} parentPage={parentPage} />
      </SheetContent>
    </Sheet>
  );
};

export default MemoDetailSidebarDrawer;
