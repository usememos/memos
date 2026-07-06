import { Settings2Icon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MAX_COLUMNS_VALUES, type MemoMaxColumns, useView } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface Props {
  className?: string;
}

// Derived from the context's canonical value list so the two can never drift; 0 renders as ∞.
const MAX_COLUMNS_OPTIONS = MAX_COLUMNS_VALUES.map((value) => ({ value, label: value === 0 ? "∞" : String(value) }));

function MemoDisplaySettingMenu({ className }: Props) {
  const t = useTranslate();
  const {
    orderByTimeAsc,
    timeBasis,
    compactMode,
    linkPreview,
    maxColumns,
    setTimeBasis,
    toggleSortOrder,
    setCompactMode,
    setLinkPreview,
    setMaxColumns,
  } = useView();
  const isApplying = orderByTimeAsc !== false || timeBasis !== "create_time" || compactMode || !linkPreview || maxColumns !== 1;

  return (
    <Popover>
      <PopoverTrigger className={cn(className, isApplying ? "text-primary bg-primary/10 rounded" : "opacity-40")}>
        <Settings2Icon className="w-4 h-auto shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="end" alignOffset={-12} sideOffset={14}>
        <div className="flex flex-col gap-2 p-1">
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-3 text-foreground">{t("memo.columns")}</span>
            {/* Radix only reports rendered item values, so no re-validation is needed here. */}
            <Select value={String(maxColumns)} onValueChange={(value) => setMaxColumns(Number(value) as MemoMaxColumns)}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAX_COLUMNS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          {/* Multi-column grids always render compact tiles, so the toggle only applies to a single column. */}
          {maxColumns === 1 && (
            <div className="w-full flex flex-row justify-between items-center">
              <span className="text-sm shrink-0 mr-3 text-foreground">{t("memo.compact-mode")}</span>
              <Switch checked={compactMode} onCheckedChange={setCompactMode} />
            </div>
          )}
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-3 text-foreground">{t("memo.link-preview")}</span>
            <Switch checked={linkPreview} onCheckedChange={setLinkPreview} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MemoDisplaySettingMenu;
