import { buttonClasses, Field, Popover, Select, Separator, Switch, Toggle, ToggleGroup, Tooltip } from "@usememos/ui";
import { ChevronDownIcon, Columns2Icon, Columns3Icon, InfinityIcon, type LucideIcon, Rows3Icon } from "lucide-react";
import type { RefObject } from "react";
import { MAX_COLUMNS_VALUES, type MemoMaxColumns, useView } from "@/contexts/ViewContext";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

interface Props {
  anchor?: RefObject<HTMLElement | null>;
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

function MemoDisplaySettingsContent() {
  const t = useTranslate();
  const { orderByTimeAsc, timeBasis, compactMode, maxColumns, setTimeBasis, setOrderByTimeAsc, setCompactMode, setMaxColumns } = useView();
  // Multi-column grids always render compact tiles, so the toggle is shown as on and locked
  // there; it only becomes a real choice at a single column.
  const compactLocked = maxColumns !== 1;

  const timeBasisOptions = { create_time: t("common.created-at"), update_time: t("common.last-updated-at") };
  const sortOrderOptions = { desc: t("memo.newest-first"), asc: t("memo.oldest-first") };

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        size="sm"
        fullWidth
        aria-label={t("memo.layout")}
        value={[String(maxColumns)]}
        // One layout always stays chosen: pressing the chosen item again keeps it.
        onValueChange={([next]) => next && setMaxColumns(Number(next) as MemoMaxColumns)}
      >
        {MAX_COLUMNS_VALUES.map((value) => {
          const { icon: Icon, key } = LAYOUT_OPTIONS[value];
          const label = t(`memo.${key}`, { n: value });
          // Column counts show as a number; every option is spelled out on hover.
          return (
            <Tooltip.Root key={value}>
              <Tooltip.Trigger
                render={
                  <Toggle value={String(value)} aria-label={label} icon={<Icon />}>
                    {value > 1 ? value.toString() : label}
                  </Toggle>
                }
              />
              <Tooltip.Popup>{t(`memo.${key}-description`, { n: value })}</Tooltip.Popup>
            </Tooltip.Root>
          );
        })}
      </ToggleGroup>

      {/* Selects, not segmented rows: the two labels of a pair don't fit side by side in every language. */}
      <Field.Root orientation="horizontal" size="sm">
        <Field.Label>{t("memo.order-by")}</Field.Label>
        <Select.Root
          items={timeBasisOptions}
          value={timeBasis}
          onValueChange={(value) => setTimeBasis(value === "update_time" ? "update_time" : "create_time")}
        >
          <Select.Trigger className="min-w-36">
            <Select.Value />
          </Select.Trigger>
          <Select.Popup>
            <Select.Item value="create_time">{timeBasisOptions.create_time}</Select.Item>
            <Select.Item value="update_time">{timeBasisOptions.update_time}</Select.Item>
          </Select.Popup>
        </Select.Root>
      </Field.Root>
      <Field.Root orientation="horizontal" size="sm">
        <Field.Label>{t("memo.direction")}</Field.Label>
        <Select.Root
          items={sortOrderOptions}
          value={orderByTimeAsc ? "asc" : "desc"}
          onValueChange={(value) => setOrderByTimeAsc(value === "asc")}
        >
          <Select.Trigger className="min-w-36">
            <Select.Value />
          </Select.Trigger>
          <Select.Popup>
            <Select.Item value="desc">{sortOrderOptions.desc}</Select.Item>
            <Select.Item value="asc">{sortOrderOptions.asc}</Select.Item>
          </Select.Popup>
        </Select.Root>
      </Field.Root>

      <Separator />

      <Field.Root orientation="horizontal" size="sm">
        <Field.Label>{t("memo.compact-mode")}</Field.Label>
        {/* Wraps inside the width the controls set, so the hint never widens the popup. */}
        {compactLocked && <Field.Description className="w-0 min-w-full">{t("memo.grid-compact-hint")}</Field.Description>}
        <Switch checked={compactLocked || compactMode} onCheckedChange={setCompactMode} disabled={compactLocked} />
      </Field.Root>
    </div>
  );
}

function MemoDisplaySettingMenu({ anchor }: Props) {
  const t = useTranslate();
  const label = `${t("common.timeline")} · ${t("memo.view-options")}`;

  return (
    <Popover.Root>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            <Popover.Trigger
              aria-label={label}
              className={cn(
                buttonClasses({ variant: "ghost", iconOnly: true }),
                "w-auto rounded-s-none px-1.5 hover:bg-mu-hover data-popup-open:[&_svg]:rotate-180",
              )}
            />
          }
        >
          <ChevronDownIcon className="mu-icon-sm transition-transform" />
        </Tooltip.Trigger>
        <Tooltip.Popup side="bottom">{label}</Tooltip.Popup>
      </Tooltip.Root>
      {/* Grows to fit long translations such as "Automatisch" instead of truncating them; the full-width group then shares the room from its labels' natural widths. */}
      <Popover.Popup anchor={anchor} align="start" aria-label={label} className="w-max min-w-(--mu-popover-width)">
        <MemoDisplaySettingsContent />
      </Popover.Popup>
    </Popover.Root>
  );
}

export default MemoDisplaySettingMenu;
