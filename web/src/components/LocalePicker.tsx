import { CheckIcon, ChevronDownIcon, GlobeIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { locales } from "@/i18n";
import { cn } from "@/lib/utils";
import { getLocaleDisplayName, localeMatchesSearch, useTranslate } from "@/utils/i18n";

const MISSING_LANGUAGE_FEEDBACK_URL =
  "https://github.com/usememos/memos/issues/new?title=Missing%20language%20support&body=Please%20add%20support%20for%20this%20language%3A%0A%0A-%20Language%3A%20";

interface LocaleSearchListProps {
  value: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}

export const LocaleSearchList = (props: LocaleSearchListProps) => {
  const { value, onChange, className } = props;
  const t = useTranslate();
  const { i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const filteredLocales = useMemo(
    () => locales.filter((locale) => localeMatchesSearch(locale, query, i18n.language)),
    [i18n.language, query],
  );

  return (
    <div
      className={cn(
        "flex max-h-[min(24rem,calc(100vh-2rem))] w-[var(--radix-popover-trigger-width)] min-w-48 max-w-[calc(100vw-2rem)] flex-col",
        className,
      )}
    >
      <div className="relative shrink-0 p-1">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          className="pl-8"
          placeholder={`${t("common.search")} ${t("common.language").toLowerCase()}`}
          aria-label={t("common.language")}
        />
      </div>
      <div className="mt-1 min-h-0 flex-1 touch-pan-y overflow-y-auto p-1" role="listbox" aria-label={t("common.language")}>
        {filteredLocales.map((locale) => (
          <div
            key={locale}
            role="option"
            aria-selected={value === locale}
            className={cn(
              "flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm px-2 text-left text-sm outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              value === locale && "bg-accent/60",
            )}
            onClick={() => onChange(locale)}
          >
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
              <span className="truncate">{getLocaleDisplayName(locale)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{locale}</span>
            </span>
            {value === locale ? <CheckIcon className="size-4 shrink-0 text-primary" /> : <span className="size-4 shrink-0" />}
          </div>
        ))}
        {filteredLocales.length === 0 && (
          <div className="px-2 py-6 text-center text-sm">
            <a
              href={MISSING_LANGUAGE_FEEDBACK_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("locale-picker.no-language-feedback")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

interface LocalePickerProps {
  value: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}

const LocalePicker = (props: LocalePickerProps) => {
  const { value, onChange, className } = props;
  const [open, setOpen] = useState(false);

  const handleChange = (locale: Locale) => {
    onChange(locale);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("w-full justify-between", className)}>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{getLocaleDisplayName(value)}</span>
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <LocaleSearchList value={value} onChange={handleChange} />
      </PopoverContent>
    </Popover>
  );
};

export default LocalePicker;
