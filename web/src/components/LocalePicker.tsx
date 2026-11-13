import { Button, Combobox, Link, Popover } from "@usememos/ui";
import { ChevronsUpDownIcon, GlobeIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { locales } from "@/i18n";
import { getLocaleDisplayName, localeMatchesSearch, useTranslate } from "@/utils/i18n";

const MISSING_LANGUAGE_FEEDBACK_URL =
  "https://github.com/usememos/memos/issues/new?title=Missing%20language%20support&body=Please%20add%20support%20for%20this%20language%3A%0A%0A-%20Language%3A%20";

interface LocalePickerProps {
  value: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}

// Each name builds an Intl.DisplayNames, so names are resolved once each, on first use, rather than per item per render.
const localeLabels = new Map<string, string>();
const localeLabel = (locale: string): string => {
  let label = localeLabels.get(locale);
  if (label === undefined) {
    label = getLocaleDisplayName(locale);
    localeLabels.set(locale, label);
  }
  return label;
};

// A stable filter keeps the Combobox from re-filtering every locale on each render.
const useLocaleFilter = () => {
  const { i18n } = useTranslation();
  return useCallback((locale: string, query: string) => localeMatchesSearch(locale, query, i18n.language), [i18n.language]);
};

/** The list half of both pickers: the matching locales, or a link to ask for a missing one. */
const LocaleOptions = () => {
  const t = useTranslate();
  return (
    <>
      <Combobox.Empty>
        <Link href={MISSING_LANGUAGE_FEEDBACK_URL} target="_blank" rel="noreferrer">
          {t("locale-picker.no-language-feedback")}
        </Link>
      </Combobox.Empty>
      <Combobox.List aria-label={t("common.language")}>
        {(locale: Locale) => (
          <Combobox.Item key={locale} value={locale}>
            <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
              <span className="truncate">{localeLabel(locale)}</span>
              <span className="shrink-0 mu-caption text-mu-text-secondary">{locale}</span>
            </span>
          </Combobox.Item>
        )}
      </Combobox.List>
    </>
  );
};

/**
 * Picks the interface language from the long list of locales: a Combobox, so typing a
 * language's name in English, in itself or in the interface language finds it. When nothing
 * matches, the list offers a link to ask for the language.
 */
const LocalePicker = ({ value, onChange, className }: LocalePickerProps) => {
  const t = useTranslate();
  const filter = useLocaleFilter();

  return (
    <Combobox.Root
      items={locales}
      value={value}
      onValueChange={(next) => next && onChange(next as Locale)}
      itemToStringLabel={localeLabel}
      filter={filter}
    >
      <Combobox.Input
        icon={<GlobeIcon />}
        aria-label={t("common.language")}
        triggerLabel={t("common.language")}
        placeholder={`${t("common.search")} ${t("common.language").toLowerCase()}`}
        className={className}
      />
      <Combobox.Popup>
        <LocaleOptions />
      </Combobox.Popup>
    </Combobox.Root>
  );
};

/**
 * The same picker behind a quiet ghost button that names the current language, for a row of
 * page-level settings such as the auth card's footer. The search and list open in a popover.
 */
export const LocalePickerButton = ({ value, onChange }: Omit<LocalePickerProps, "className">) => {
  const t = useTranslate();
  const filter = useLocaleFilter();
  const [open, setOpen] = useState(false);
  const searchLabel = `${t("common.search")} ${t("common.language").toLowerCase()}`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button variant="ghost" size="sm" icon={<GlobeIcon />} iconEnd={<ChevronsUpDownIcon />} aria-label={t("common.language")}>
            {localeLabel(value)}
          </Button>
        }
      />
      <Popover.Popup side="top" align="start" variant="list" aria-label={t("common.language")}>
        <Combobox.Root
          items={locales}
          inline
          autoHighlight
          value={value}
          onValueChange={(next) => {
            if (!next) return;
            onChange(next as Locale);
            setOpen(false);
          }}
          itemToStringLabel={localeLabel}
          filter={filter}
        >
          <Combobox.Input className="mb-1" aria-label={searchLabel} placeholder={searchLabel} />
          <LocaleOptions />
        </Combobox.Root>
      </Popover.Popup>
    </Popover.Root>
  );
};

export default LocalePicker;
