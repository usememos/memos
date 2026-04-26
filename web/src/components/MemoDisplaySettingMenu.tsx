import { Settings2Icon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useView } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface Props {
  className?: string;
}

function MemoDisplaySettingMenu({ className }: Props) {
  const t = useTranslate();
  const { orderByTimeAsc, timeBasis, setTimeBasis, toggleSortOrder } = useView();
  const isApplying = orderByTimeAsc !== false || timeBasis !== "create_time";

  return (
    <Popover>
      <PopoverTrigger className={cn(className, isApplying ? "text-primary bg-primary/10 rounded" : "opacity-40")}>
        <Settings2Icon className="w-4 h-auto shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="end" alignOffset={-12} sideOffset={14}>
        <div className="flex flex-col gap-2 p-1">
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-3 text-foreground">{t("memo.shown-time")}</span>
            <Select value={timeBasis} onValueChange={(value) => setTimeBasis(value === "update_time" ? "update_time" : "create_time")}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_time">{t("common.created-at")}</SelectItem>
                <SelectItem value="update_time">{t("common.last-updated-at")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-3 text-foreground">{t("memo.order")}</span>
            <Select
              value={orderByTimeAsc.toString()}
              onValueChange={(value) => {
                if ((value === "true") !== orderByTimeAsc) {
                  toggleSortOrder();
                }
              }}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">{t("memo.newest-first")}</SelectItem>
                <SelectItem value="true">{t("memo.oldest-first")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MemoDisplaySettingMenu;
