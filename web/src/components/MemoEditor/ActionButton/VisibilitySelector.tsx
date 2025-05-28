import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import VisibilityIcon from "@/components/VisibilityIcon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Visibility } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  value: Visibility;
  onChange: (visibility: Visibility) => void;
  className?: string;
}

const VisibilitySelector = (props: Props) => {
  const { value, onChange, className } = props;
  const t = useTranslate();
  const [open, setOpen] = useState(false);

  const visibilityOptions = [
    { value: Visibility.PRIVATE, label: t("memo.visibility.private") },
    { value: Visibility.PROTECTED, label: t("memo.visibility.protected") },
    { value: Visibility.PUBLIC, label: t("memo.visibility.public") },
  ];

  const currentOption = visibilityOptions.find((option) => option.value === value);

  const handleSelect = (visibility: Visibility) => {
    onChange(visibility);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center justify-center gap-1 px-0.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 transition-colors ${className || ""}`}
          type="button"
        >
          <VisibilityIcon className="w-3 h-3" visibility={value} />
          <span className="hidden sm:inline">{currentOption?.label}</span>
          <ChevronDownIcon className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="!p-1" align="end" sideOffset={2} alignOffset={-4}>
        <div className="flex flex-col gap-0.5">
          {visibilityOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`flex items-center gap-1 px-1 py-1 text-xs text-left dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded transition-colors ${
                option.value === value ? "bg-gray-50 dark:bg-zinc-800" : ""
              }`}
            >
              <VisibilityIcon className="w-3 h-3" visibility={option.value} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default VisibilitySelector;
