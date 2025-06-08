import { Option, Select } from "@mui/joy";
import { Settings2Icon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { viewStore } from "@/store/v2";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/Popover";

interface Props {
  className?: string;
}

const MemoDisplaySettingMenu = observer(({ className }: Props) => {
  const t = useTranslate();
  const isApplying = viewStore.state.orderByTimeAsc !== false || viewStore.state.layout !== "LIST";

  return (
    <Popover>
      <PopoverTrigger
        className={cn(className, isApplying ? "text-teal-600 bg-teal-100 dark:text-teal-500 dark:bg-teal-900 rounded" : "opacity-40")}
      >
        <Settings2Icon className="w-4 h-auto shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="end" alignOffset={-12} sideOffset={14}>
        <div className="flex flex-col gap-2 p-1">
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-3 dark:text-zinc-400">{t("memo.direction")}</span>
            <Select
              value={viewStore.state.orderByTimeAsc}
              onChange={(_, value) =>
                viewStore.state.setPartial({
                  orderByTimeAsc: Boolean(value),
                })
              }
            >
              <Option value={false}>{t("memo.direction-desc")}</Option>
              <Option value={true}>{t("memo.direction-asc")}</Option>
            </Select>
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-3 dark:text-zinc-400">{t("common.layout")}</span>
            <Select
              value={viewStore.state.layout}
              onChange={(_, value) =>
                viewStore.state.setPartial({
                  layout: value as "LIST" | "MASONRY",
                })
              }
            >
              <Option value={"LIST"}>{t("memo.list")}</Option>
              <Option value={"MASONRY"}>{t("memo.masonry")}</Option>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default MemoDisplaySettingMenu;
