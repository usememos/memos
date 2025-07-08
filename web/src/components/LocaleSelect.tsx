import { GlobeIcon } from "lucide-react";
import { FC } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { locales } from "@/i18n";

interface Props {
  value: Locale;
  onChange: (locale: Locale) => void;
}

const LocaleSelect: FC<Props> = (props: Props) => {
  const { onChange, value } = props;

  const handleSelectChange = async (locale: Locale) => {
    onChange(locale);
  };

  return (
    <Select value={value} onValueChange={handleSelectChange}>
      <SelectTrigger>
        <div className="flex items-center gap-2">
          <GlobeIcon className="w-4 h-auto" />
          <SelectValue placeholder="Select language" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {locales.map((locale) => {
          try {
            const languageName = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
            if (languageName) {
              return (
                <SelectItem key={locale} value={locale}>
                  {languageName.charAt(0).toUpperCase() + languageName.slice(1)}
                </SelectItem>
              );
            }
          } catch {
            // do nth
          }

          return (
            <SelectItem key={locale} value={locale}>
              {locale}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

export default LocaleSelect;
