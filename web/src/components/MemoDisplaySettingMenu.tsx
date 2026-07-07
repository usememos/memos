import { Columns2Icon, Columns3Icon, InfinityIcon, type LucideIcon, Rows3Icon, Settings2Icon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_COLUMNS_VALUES, type MemoMaxColumns, useView } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface Props {
  className?: string;
}

// Keyed by the context's canonical value list, so adding a column option forces an icon and
// wording here at compile time. The i18n param is deliberately named `n`, not `count` —
// i18next would route `count` through plural-form lookup.
const LAYOUT_OPTIONS: Record<MemoMaxColumns, { icon: LucideIcon; key: "layout-list" | "layout-columns" | "layout-auto" }> = {
  1: { icon: Rows3Icon, key: "layout-list" },
  2: { icon: Columns2Icon, key: "layout-columns" },
  3: { icon: Columns3Icon, key: "layout-columns" },
  0: { icon: InfinityIcon, key: "layout-auto" },
};

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
  // Multi-column grids always render compact tiles, so the toggle is shown as on and locked
  // there; it only becomes a real choice at a single column.
  const compactLocked = maxColumns !== 1;

  return (
    <Popover>
      <PopoverTrigger className={cn(className, isApplying ? "text-primary bg-primary/10 rounded" : "opacity-40")}>
        <Settings2Icon className="w-4 h-auto shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="end" alignOffset={-12} sideOffset={14}>
        <div className="flex flex-col gap-2 p-1">
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-sm shrink-0 mr-3 text-foreground">{t("memo.layout")}</span>
            {/* A quiet muted track (28px tall, borderless); only the active option carries the accent
                fill. A radiogroup with roving tabindex, since the options are mutually exclusive. */}
            <div
              role="radiogroup"
              aria-label={t("memo.layout")}
              className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5"
              onKeyDown={(event) => {
                const delta =
                  event.key === "ArrowRight" || event.key === "ArrowDown"
                    ? 1
                    : event.key === "ArrowLeft" || event.key === "ArrowUp"
                      ? -1
                      : 0;
                if (delta === 0) return;
                event.preventDefault();
                const index = MAX_COLUMNS_VALUES.indexOf(maxColumns);
                const next = MAX_COLUMNS_VALUES[(index + delta + MAX_COLUMNS_VALUES.length) % MAX_COLUMNS_VALUES.length];
                setMaxColumns(next);
                event.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
              }}
            >
              {MAX_COLUMNS_VALUES.map((value) => {
                const { icon: Icon, key } = LAYOUT_OPTIONS[value];
                const label = t(`memo.${key}`, { n: value });
                const active = maxColumns === value;
                return (
                  <Tooltip key={value}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={label}
                        tabIndex={active ? 0 : -1}
                        data-value={value}
                        onClick={() => setMaxColumns(value)}
                        className={cn(
                          "grid h-6 w-7 place-items-center rounded-md transition-colors",
                          active ? "bg-accent text-accent-foreground" : "text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground",
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{label}</p>
                      <p className="text-primary-foreground/70">{t(`memo.${key}-description`, { n: value })}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
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
          <div className="w-full flex flex-row justify-between items-center">
            <span className={cn("text-sm shrink-0 mr-3", compactLocked ? "text-muted-foreground" : "text-foreground")}>
              {t("memo.compact-mode")}
            </span>
            <Switch checked={compactLocked || compactMode} onCheckedChange={setCompactMode} disabled={compactLocked} />
          </div>
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
