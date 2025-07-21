import { Settings2Icon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { viewStore } from "@/store";
import { useTranslate } from "@/utils/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface Props {
  className?: string;
}

const MemoDisplaySettingMenu = observer(({ className }: Props) => {
  const t = useTranslate();
  const isApplying = viewStore.state.orderByTimeAsc !== false || viewStore.state.layout !== "LIST";

  return (
    <Popover>
      <PopoverTrigger className={cn(className, isApplying ? "text-primary bg-primary/10 rounded" : "opacity-40")}>
        <Settings2Icon className="w-4 h-auto shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="end" alignOffset={-12} sideOffset={14}>
        <div className="flex flex-col gap-2 p-1">
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-3 text-foreground">{t("memo.direction")}</span>
            <Select
              value={viewStore.state.orderByTimeAsc.toString()}
              onValueChange={(value) =>
                viewStore.state.setPartial({
                  orderByTimeAsc: value === "true",
                })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">{t("memo.direction-desc")}</SelectItem>
                <SelectItem value="true">{t("memo.direction-asc")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-3 text-foreground">{t("common.layout")}</span>
            <Select
              value={viewStore.state.layout}
              onValueChange={(value) =>
                viewStore.state.setPartial({
                  layout: value as "LIST" | "MASONRY",
                })
              }
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LIST">{t("memo.list")}</SelectItem>
                <SelectItem value="MASONRY">{t("memo.masonry")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default MemoDisplaySettingMenu;
