import { Option, Select } from "@mui/joy";
import { FC } from "react";
import { availableLocales } from "@/i18n";
import Icon from "./Icon";

interface Props {
  value: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}

const LocaleSelect: FC<Props> = (props: Props) => {
  const { onChange, value, className } = props;

  const handleSelectChange = async (locale: Locale) => {
    onChange(locale);
  };

  return (
    <Select
      className={`!min-w-[10rem] w-auto whitespace-nowrap ${className ?? ""}`}
      startDecorator={<Icon.Globe className="w-4 h-auto" />}
      value={value}
      onChange={(_, value) => handleSelectChange(value as Locale)}
    >
      {availableLocales.map((locale) => {
        const languageName = new Intl.DisplayNames([locale], { type: "language" }).of(locale);
        if (languageName === undefined) {
          return (
            <Option key={locale} value={locale}>
              {locale}
            </Option>
          );
        }
        return (
          <Option key={locale} value={locale}>
            {languageName.charAt(0).toUpperCase() + languageName.slice(1)}
          </Option>
        );
      })}
    </Select>
  );
};

export default LocaleSelect;
