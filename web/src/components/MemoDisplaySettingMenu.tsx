import { Columns2Icon, Columns3Icon, InfinityIcon, type LucideIcon, Rows3Icon, SlidersHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SIDEBAR_SECTION_ACTION_BUTTON_CLASSES, SIDEBAR_SECTION_ACTION_ICON_CLASSES } from "@/components/AppSidebar/SidebarSection";
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

interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
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

const SettingRow = ({ label, description, children }: SettingRowProps) => (
  <div className="flex min-h-7 items-center justify-between gap-3">
    <div className="min-w-0">
      <p className="text-[13px] leading-5 text-foreground">{label}</p>
      {description && <p className="text-[11px] leading-4 text-muted-foreground">{description}</p>}
    </div>
    {children}
  </div>
);

function MemoDisplaySettingsContent() {
  const t = useTranslate();
  const {
    orderByTimeAsc,
    timeBasis,
    compactMode,
    linkPreview,
    maxColumns,
    setTimeBasis,
    setOrderByTimeAsc,
    setCompactMode,
    setLinkPreview,
    setMaxColumns,
  } = useView();
  // Multi-column grids always render compact tiles, so the toggle is shown as on and locked
  // there; it only becomes a real choice at a single column.
  const compactLocked = maxColumns !== 1;

  const timeBasisOptions = [
    { value: "create_time", label: t("common.created-at") },
    { value: "update_time", label: t("common.last-updated-at") },
  ];
  const sortOrderOptions = [
    { value: "desc", label: t("memo.newest-first") },
    { value: "asc", label: t("memo.oldest-first") },
  ];

  return (
    <div>
      <section className="px-3 py-2.5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/65">{t("memo.layout")}</p>
        <div
          role="radiogroup"
          aria-label={t("memo.layout")}
          className="grid grid-cols-4 gap-0.5 rounded-lg bg-muted/55 p-0.5"
          onKeyDown={(event) => {
            const delta =
              event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
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
            const description = t(`memo.${key}-description`, { n: value });
            const shortLabel = value > 1 ? value.toString() : label;
            const active = maxColumns === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={label}
                title={description}
                tabIndex={active ? 0 : -1}
                data-value={value}
                onClick={() => setMaxColumns(value)}
                className={cn(
                  "flex h-8 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-[11px] transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2 border-t border-border/60 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/65">{t("memo.order")}</p>
        <SettingRow label={t("memo.order-by")}>
          <Select
            value={timeBasis}
            items={timeBasisOptions}
            onValueChange={(value) => setTimeBasis(value === "update_time" ? "update_time" : "create_time")}
          >
            <SelectTrigger size="sm" className="w-32" aria-label={t("memo.order-by")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeBasisOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label={t("memo.direction")}>
          <Select
            value={orderByTimeAsc ? "asc" : "desc"}
            items={sortOrderOptions}
            onValueChange={(value) => setOrderByTimeAsc(value === "asc")}
          >
            <SelectTrigger size="sm" className="w-32" aria-label={t("memo.direction")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOrderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </section>

      <section className="space-y-2 border-t border-border/60 px-3 py-2.5">
        <SettingRow label={t("memo.compact-mode")} description={compactLocked ? t("memo.grid-compact-hint") : undefined}>
          <Switch
            aria-label={t("memo.compact-mode")}
            checked={compactLocked || compactMode}
            onCheckedChange={setCompactMode}
            disabled={compactLocked}
          />
        </SettingRow>
        <SettingRow label={t("memo.link-preview")}>
          <Switch aria-label={t("memo.link-preview")} checked={linkPreview} onCheckedChange={setLinkPreview} />
        </SettingRow>
      </section>
    </div>
  );
}

function MemoDisplaySettingMenu({ className }: Props) {
  const t = useTranslate();

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <PopoverTrigger
            aria-label={t("memo.view-options")}
            className={cn(
              "flex items-center justify-center",
              SIDEBAR_SECTION_ACTION_BUTTON_CLASSES,
              "data-popup-open:bg-sidebar-accent data-popup-open:text-foreground",
              className,
            )}
          >
            <SlidersHorizontalIcon className={SIDEBAR_SECTION_ACTION_ICON_CLASSES} strokeWidth={1.8} />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{t("memo.view-options")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={6} className="w-64 p-0">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="text-[13px] font-medium text-foreground">{t("memo.view-options")}</p>
        </div>
        <MemoDisplaySettingsContent />
      </PopoverContent>
    </Popover>
  );
}

export default MemoDisplaySettingMenu;
