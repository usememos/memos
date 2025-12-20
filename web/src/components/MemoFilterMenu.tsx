import { CheckCircleIcon, CodeIcon, FilterIcon, LinkIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { cn } from "@/lib/utils";
import { memoFilterStore } from "@/store";
import { useTranslate } from "@/utils/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface Props {
  className?: string;
}

const MemoFilterMenu = observer(({ className }: Props) => {
  const t = useTranslate();
  const filters = memoFilterStore.filters;

  const hasActiveFilters = filters.some(
    (f) => 
      f.factor === "property.hasLink" || 
      f.factor === "property.hasTaskList" || 
      f.factor === "property.hasCode"
  );

  const isFilterActive = (factor: string) => {
    return filters.some((f) => f.factor === factor);
  };

  const toggleFilter = (factor: string) => {
    const existing = filters.find((f) => f.factor === factor);
    
    if (existing) {
      memoFilterStore.removeFilter((f) => f.factor === factor);
    } else {
      memoFilterStore.addFilter({
        factor: factor as any,
        value: "",
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger className={cn(className, hasActiveFilters ? "text-primary bg-primary/10 rounded" : "opacity-40")}>
        <FilterIcon className="w-4 h-auto shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="end" alignOffset={-12} sideOffset={14}>
        <div className="flex flex-col gap-1 p-1 min-w-[160px]">
          <div className="text-xs font-medium text-muted-foreground px-2 py-1">
            {t("common.filter")}
          </div>
          
          <button
            onClick={() => toggleFilter("property.hasLink")}
            className={cn(
              "w-full flex flex-row items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-sm",
              isFilterActive("property.hasLink") && "bg-accent text-primary"
            )}
          >
            <LinkIcon className="w-4 h-4 shrink-0" />
            <span>{t("memo.links")}</span>
            {isFilterActive("property.hasLink") && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </button>

          <button
            onClick={() => toggleFilter("property.hasTaskList")}
            className={cn(
              "w-full flex flex-row items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-sm",
              isFilterActive("property.hasTaskList") && "bg-accent text-primary"
            )}
          >
            <CheckCircleIcon className="w-4 h-4 shrink-0" />
            <span>{t("memo.to-do")}</span>
            {isFilterActive("property.hasTaskList") && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </button>

          <button
            onClick={() => toggleFilter("property.hasCode")}
            className={cn(
              "w-full flex flex-row items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-sm",
              isFilterActive("property.hasCode") && "bg-accent text-primary"
            )}
          >
            <CodeIcon className="w-4 h-4 shrink-0" />
            <span>{t("memo.code")}</span>
            {isFilterActive("property.hasCode") && (
              <span className="ml-auto text-xs">✓</span>
            )}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
});

export default MemoFilterMenu;