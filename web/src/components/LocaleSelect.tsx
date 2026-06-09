import { FC } from "react";
import LocalePicker from "@/components/LocalePicker";
import { loadLocale } from "@/utils/i18n";

interface Props {
  value: Locale;
  onChange: (locale: Locale) => void;
}

const LocaleSelect: FC<Props> = (props: Props) => {
  const { onChange, value } = props;

  const handleSelectChange = async (locale: Locale) => {
    // Apply locale globally immediately
    loadLocale(locale);
    // Also notify parent component
    onChange(locale);
  };

  return <LocalePicker value={value} onChange={handleSelectChange} />;
};

export default LocaleSelect;
