import { create } from "@bufbuild/protobuf";
import { RotateCcwIcon, SearchIcon } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import SpaceIcon from "@/components/SpaceIcon";
import SpaceMark from "@/components/SpaceMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SPACE_EMOJI } from "@/lib/space-emoji";
import { SPACE_SYMBOLS, spaceIconsEqual } from "@/lib/space-icons";
import { cn } from "@/lib/utils";
import { type Space_Icon, Space_IconSchema } from "@/types/proto/api/v1/space_service_pb";
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
const symbols = Object.keys(SPACE_SYMBOLS).map((name) => ({
  label: symbolLabels[name] ?? name.replaceAll("-", " ").replace(/^./, (char) => char.toUpperCase()),
  icon: create(Space_IconSchema, { value: { case: "lucide", value: name } }),
}));
const emojis = SPACE_EMOJI.map(([emoji, label]) => ({ label, icon: create(Space_IconSchema, { value: { case: "emoji", value: emoji } }) }));

interface Props {
  value?: Space_Icon;
  onChange: (icon: Space_Icon | undefined) => void;
  disabled?: boolean;
}

function SpaceIconPicker({ value, onChange, disabled }: Props) {
  const t = useTranslate();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("icons");
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const search = query.trim().toLowerCase();
  const options = (tab === "icons" ? symbols : emojis).filter(
    (option) => option.label.toLowerCase().includes(search) || option.icon.value.value?.includes(search),
  );
  const customEmoji = query.trim() || (value?.value.case === "emoji" ? value.value.value : "");
  if (tab === "emoji" && emojiSet.has(customEmoji) && !options.some((option) => option.icon.value.value === customEmoji)) {
    options.unshift({
      label: t("space.icon.use-emoji", { emoji: customEmoji }),
      icon: create(Space_IconSchema, { value: { case: "emoji", value: customEmoji } }),
    });
  }

  const select = (icon?: Space_Icon) => {
    onChange(icon);
    setOpen(false);
  };
  const changeTab = (next: string) => {
    setTab(next);
    setQuery("");
    setFocusedIndex(0);
  };
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
    let next = index;
    if (event.key in offsets) next = Math.max(0, Math.min(options.length - 1, index + offsets[event.key]));
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return;
    event.preventDefault();
    setFocusedIndex(next);
    gridRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          changeTab(value?.value.case === "emoji" ? "emoji" : "icons");
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 p-0"
            disabled={disabled}
            aria-label={t("space.icon.change")}
            title={t("space.icon.change")}
          />
        }
      >
        <SpaceMark icon={value} size="lg" className="size-full bg-transparent" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[290px] max-w-[calc(100vw-2rem)] p-2"
        aria-label={t("space.icon.change")}
        initialFocus={searchRef}
      >
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="mb-2 rounded-md bg-muted/60 p-0.5" aria-label={t("space.icon.kind")}>
            {(["icons", "emoji"] as const).map((name) => (
              <TabsTrigger
                key={name}
                id={`${id}-${name}`}
                value={name}
                aria-controls={`${id}-panel`}
                tabIndex={tab === name ? 0 : -1}
                className="flex-1 py-1 text-xs"
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    const next = name === "icons" ? "emoji" : "icons";
                    changeTab(next);
                    document.getElementById(`${id}-${next}`)?.focus();
                  }
                }}
              >
                {t(`space.icon.${name}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}>
          <div className="relative mb-2">
            <SearchIcon aria-hidden className="pointer-events-none absolute start-2 top-2 size-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              className="ps-8 text-sm"
              aria-label={t(tab === "icons" ? "space.icon.search-icons" : "space.icon.search-emoji")}
              placeholder={t(tab === "icons" ? "space.icon.search-icons" : "space.icon.search-emoji")}
              onChange={(event) => {
                setQuery(event.target.value);
                setFocusedIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (options[0]) select(options[0].icon);
                } else if (event.key === "ArrowDown" && options.length) {
                  event.preventDefault();
                  setFocusedIndex(0);
                  gridRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
                }
              }}
            />
          </div>
          <div className="max-h-56 overflow-y-auto overscroll-contain" ref={gridRef}>
            {options.length ? (
              <div className="grid grid-cols-8 gap-0.5">
                {options.map((option, index) => (
                  <Button
                    key={`${option.icon.value.case}:${option.icon.value.value}`}
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={option.label}
                    title={option.label}
                    aria-pressed={spaceIconsEqual(value, option.icon)}
                    tabIndex={index === Math.min(focusedIndex, options.length - 1) ? 0 : -1}
                    onFocus={() => setFocusedIndex(index)}
                    onKeyDown={(event) => moveFocus(event, index)}
                    onClick={() => select(option.icon)}
                    className={cn("rounded-md", spaceIconsEqual(value, option.icon) && "bg-accent ring-1 ring-inset ring-primary/40")}
                  >
                    <SpaceIcon icon={option.icon} className={tab === "emoji" ? "size-5 text-xl" : "size-4"} />
                  </Button>
                ))}
              </div>
            ) : (
              <p role="status" className="py-8 text-center text-xs text-muted-foreground">
                {t("space.icon.no-results")}
              </p>
            )}
          </div>
          {tab === "emoji" && <p className="px-1 pt-2 text-xs leading-4 text-muted-foreground">{t("space.icon.emoji-help")}</p>}
        </div>
        <div className="mt-2 border-t pt-1.5">
          <Button type="button" variant="quiet" size="sm" className="w-full justify-start" disabled={!value} onClick={() => select()}>
            <RotateCcwIcon aria-hidden className="size-3.5" />
            {t("space.icon.reset")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default SpaceIconPicker;
