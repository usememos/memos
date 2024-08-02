import { Option, Select } from "@mui/joy";
import clsx from "clsx";
import { useMemoFilterStore } from "@/store/v1";
import Icon from "./Icon";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/Popover";

interface Props {
  className?: string;
}

const MemoDisplaySettingMenu = ({ className }: Props) => {
  const memoFilterStore = useMemoFilterStore();
  const isApplying = Boolean(memoFilterStore.orderByTimeAsc) !== false;

  return (
    <Popover>
      <PopoverTrigger
        className={clsx(className, isApplying ? "text-teal-600 bg-teal-50 dark:text-teal-500 dark:bg-teal-900 rounded-sm" : "opacity-40")}
      >
        <Icon.Settings2 className="w-4 h-auto shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="end" alignOffset={-12}>
        <div className="flex flex-col gap-2">
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-2">Order by</span>
            <Select value="displayTime">
              <Option value={"displayTime"}>Display Time</Option>
            </Select>
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-2">Direction</span>
            <Select value={memoFilterStore.orderByTimeAsc} onChange={(_, value) => memoFilterStore.setOrderByTimeAsc(Boolean(value))}>
              <Option value={false}>DESC</Option>
              <Option value={true}>ASC</Option>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MemoDisplaySettingMenu;
