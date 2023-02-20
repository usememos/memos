import { Option, Select } from "@mui/joy";
import { FC } from "react";
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
      <Option value="en">English</Option>
      <Option value="zh">简体中文</Option>
      <Option value="vi">Tiếng Việt</Option>
      <Option value="fr">French</Option>
      <Option value="nl">Nederlands</Option>
      <Option value="sv">Svenska</Option>
      <Option value="de">German</Option>
      <Option value="es">Español</Option>
      <Option value="uk">Українська</Option>
      <Option value="ru">Русский</Option>
      <Option value="it">Italiano</Option>
      <Option value="hant">繁體中文</Option>
      <Option value="ko">한국어</Option>
    </Select>
  );
};

export default LocaleSelect;
