import { AlarmClockIcon } from "lucide-react";
import { type FC, useId } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import i18n from "@/i18n";
import { useTranslate } from "@/utils/i18n";
import { isHiddenUntilFuture, parseDateTimeLocalValue, toDateTimeLocalValue } from "../utils/hideUntil";

interface HideUntilSelectorProps {
  value?: Date;
  onChange: (next: Date | undefined) => void;
}

const HideUntilSelector: FC<HideUntilSelectorProps> = ({ value, onChange }) => {
  const t = useTranslate();
  const inputId = useId();
  const active = isHiddenUntilFuture(value);
  const shortLabel = value?.toLocaleDateString(i18n.language, { day: "numeric", month: "short" });

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="quiet" size="sm" aria-pressed={active} aria-label={t("editor.hide-until.title")} />}>
        <AlarmClockIcon className="size-4 opacity-75" strokeWidth={1.8} />
        {value && <span className="truncate">{shortLabel}</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2 p-3">
        <div className="space-y-1">
          <label htmlFor={inputId} className="text-xs font-medium">
            {t("editor.hide-until.title")}
          </label>
          <p className="text-2xs text-muted-foreground">{t("editor.hide-until.description")}</p>
        </div>
        <input
          id={inputId}
          type="datetime-local"
          className="block w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
          min={toDateTimeLocalValue(new Date())}
          value={value ? toDateTimeLocalValue(value) : ""}
          onChange={(e) => onChange(parseDateTimeLocalValue(e.target.value))}
        />
        {value && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(undefined)}>
            {t("common.clear")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default HideUntilSelector;
