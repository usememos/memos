import { Button, Combobox, Popover, Toggle, ToggleGroup } from "@usememos/ui";
import { AstroidIcon, type LucideIcon, RotateCcwIcon } from "lucide-react";
import { useRef, useState } from "react";
import CustomIcon from "@/components/CustomIcon";
import type { CustomIconValue } from "@/lib/custom-icons";
import { CUSTOM_SYMBOLS, customIconsEqual } from "@/lib/custom-icons";
import { SPACE_EMOJI } from "@/lib/space-emoji";
import { useTranslate } from "@/utils/i18n";
import { FULLY_QUALIFIED_EMOJI } from "@/utils/tag-unicode-data";

const emojiSet = new Set(FULLY_QUALIFIED_EMOJI);
const symbolLabels: Record<string, string> = {
  astroid: "Space",
  "book-open": "Book",
  "chart-no-axes-combined": "Chart",
  "check-check": "Checklist",
  "flask-conical": "Science",
  "flower-2": "Flower",
  "graduation-cap": "Education",
  "map-pin": "Location",
  "notebook-pen": "Notebook",
};
interface IconOption {
  label: string;
  icon: CustomIconValue;
}

const GRID_COLUMNS = 8;
const symbols: IconOption[] = Object.keys(CUSTOM_SYMBOLS).map((name) => ({
  label: symbolLabels[name] ?? name.replaceAll("-", " ").replace(/^./, (char) => char.toUpperCase()),
  icon: { value: { case: "lucide", value: name } } satisfies CustomIconValue,
}));
const emojis: IconOption[] = SPACE_EMOJI.map(([emoji, label]) => ({
  label,
  icon: { value: { case: "emoji", value: emoji } } satisfies CustomIconValue,
}));

interface Props {
  value?: CustomIconValue;
  onChange: (icon: CustomIconValue | undefined) => void;
  disabled?: boolean;
  label: string;
  fallback?: LucideIcon;
}

function CustomIconPicker({ value, onChange, disabled, label, fallback = AstroidIcon }: Props) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("icons");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const search = query.trim().toLowerCase();
  const options: IconOption[] = (tab === "icons" ? symbols : emojis).filter(
    (option) => option.label.toLowerCase().includes(search) || option.icon.value.value?.includes(search),
  );
  const customEmoji = query.trim() || (value?.value.case === "emoji" ? value.value.value : "");
  if (tab === "emoji" && emojiSet.has(customEmoji) && !options.some((option) => option.icon.value.value === customEmoji)) {
    options.unshift({
      label: t("space.icon.use-emoji", { emoji: customEmoji }),
      icon: { value: { case: "emoji", value: customEmoji } },
    });
  }
  const rows: IconOption[][] = [];
  for (let index = 0; index < options.length; index += GRID_COLUMNS) rows.push(options.slice(index, index + GRID_COLUMNS));

  const select = (icon?: CustomIconValue) => {
    onChange(icon);
    setOpen(false);
  };
  const changeTab = (next: string) => {
    setTab(next);
    setQuery("");
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          changeTab(value?.value.case === "emoji" ? "emoji" : "icons");
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger
        render={
          <Button
            type="button"
            variant="neutral"
            disabled={disabled}
            aria-label={label}
            title={label}
            icon={<CustomIcon icon={value} fallback={fallback} className="size-5 text-xl" />}
          />
        }
      />
      <Popover.Popup align="start" className="w-[306px] max-w-[calc(100vw-2rem)]" aria-label={label} initialFocus={searchRef}>
        <ToggleGroup
          size="sm"
          aria-label={t("space.icon.kind")}
          value={[tab]}
          onValueChange={([next]: string[]) => next && changeTab(next)}
        >
          {(["icons", "emoji"] as const).map((name) => (
            <Toggle key={name} value={name}>
              {t(`space.icon.${name}`)}
            </Toggle>
          ))}
        </ToggleGroup>
        <div>
          {/* The rows are filtered here (labels and the glyph itself, plus a pasted emoji), so the
              combobox's own filter is off and it only drives the 2-D highlight and Enter. */}
          <Combobox.Root
            items={options}
            filter={null}
            inline
            grid
            autoHighlight
            value={value ? { label: "", icon: value } : null}
            isItemEqualToValue={(item: IconOption, current: IconOption) => customIconsEqual(item.icon, current.icon)}
            itemToStringLabel={(item: IconOption) => item.label}
            onValueChange={(item: IconOption | null) => {
              if (item) select(item.icon);
            }}
            inputValue={query}
            onInputValueChange={(next, { reason }) => {
              // Picking a cell would write its label into the search; the popup closes instead.
              if (reason === "input-change" || reason === "input-clear") setQuery(next);
            }}
            onOpenChange={(next, { reason }) => {
              if (!next && reason === "escape-key") setOpen(false);
            }}
          >
            <Combobox.Input
              ref={searchRef}
              className="mb-1"
              aria-label={t(tab === "icons" ? "space.icon.search-icons" : "space.icon.search-emoji")}
              placeholder={t(tab === "icons" ? "space.icon.search-icons" : "space.icon.search-emoji")}
            />
            <Combobox.Empty>{t("space.icon.no-results")}</Combobox.Empty>
            {/* The list's own padding keeps highlighted cells clear of its scroll edge; the negative
                margin lines the cells up with the search box as before. */}
            <Combobox.List aria-label={t(`space.icon.${tab === "icons" ? "icons" : "emoji"}`)} className="-mx-1">
              {rows.map((row) => (
                <Combobox.Row key={`${row[0].icon.value.case}:${row[0].icon.value.value}`}>
                  {row.map((option) => (
                    <Combobox.Item
                      key={`${option.icon.value.case}:${option.icon.value.value}`}
                      value={option}
                      aria-label={option.label}
                      title={option.label}
                    >
                      <CustomIcon icon={option.icon} className={tab === "emoji" ? "size-5 text-xl" : undefined} />
                    </Combobox.Item>
                  ))}
                </Combobox.Row>
              ))}
            </Combobox.List>
          </Combobox.Root>
          {tab === "emoji" && <p className="px-1 pt-2 mu-caption text-mu-text-secondary">{t("space.icon.emoji-help")}</p>}
        </div>
        <div className="mt-2 border-t pt-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            disabled={!value}
            onClick={() => select()}
            icon={<RotateCcwIcon aria-hidden />}
          >
            {t("space.icon.reset")}
          </Button>
        </div>
      </Popover.Popup>
    </Popover.Root>
  );
}

export default CustomIconPicker;
