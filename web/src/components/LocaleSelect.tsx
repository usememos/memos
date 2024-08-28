import { Option, Select } from "@mui/joy";
import { GlobeIcon } from "lucide-react";
import { FC } from "react";
import { locales } from "@/i18n";

interface Props {
  value: Locale;
  className?: string;
  onChange: (locale: Locale) => void;
}

const LocaleSelect: FC<Props> = (props: Props) => {
  const { onChange, value, className } = props;

  const handleSelectChange = async (locale: Locale) => {
    onChange(locale);
  };

  return (
    <Select
      className={`!min-w-[10rem] w-auto whitespace-nowrap ${className ?? ""}`}
      startDecorator={<GlobeIcon className="w-4 h-auto" />}
      value={value}
      onChange={(_, value) => handleSelectChange(value as Locale)}
    >
      {locales.map((locale) => {
        try {
          const languageName = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
          if (languageName) {
            return (
              <Option key={locale} value={locale}>
                {languageName.charAt(0).toUpperCase() + languageName.slice(1)}
              </Option>
            );
          }
        } catch (error) {
          // do nth
        }

        return (
          <Option key={locale} value={locale}>
            {locale}
          </Option>
        );
      })}
    </Select>
  );
};

export default LocaleSelect;
