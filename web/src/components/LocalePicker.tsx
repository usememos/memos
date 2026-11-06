import { Combobox, Link } from "@usememos/ui";
import { GlobeIcon } from "lucide-react";
import { useCallback } from "react";
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

/**
 * Picks the interface language from the long list of locales: a Combobox, so typing a
 * language's name in English, in itself or in the interface language finds it. When nothing
 * matches, the list offers a link to ask for the language.
 */
const LocalePicker = ({ value, onChange, className }: LocalePickerProps) => {
  const t = useTranslate();
  const { i18n } = useTranslation();
  // A stable filter keeps the Combobox from re-filtering every locale on each render.
  const filter = useCallback((locale: string, query: string) => localeMatchesSearch(locale, query, i18n.language), [i18n.language]);

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
        <Combobox.Empty>
          <Link href={MISSING_LANGUAGE_FEEDBACK_URL} target="_blank" rel="noreferrer">
            {t("locale-picker.no-language-feedback")}
          </Link>
        </Combobox.Empty>
        <Combobox.List>
          {(locale: Locale) => (
            <Combobox.Item key={locale} value={locale}>
              <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <span className="truncate">{localeLabel(locale)}</span>
                <span className="shrink-0 mu-caption text-mu-ink-muted">{locale}</span>
              </span>
            </Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Root>
  );
};

export default LocalePicker;
