import { Option, Select } from "@mui/joy";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";

interface Props {
  value: Appearance;
  onChange: (appearance: Appearance) => void;
  className?: string;
}

const appearanceList = ["system", "light", "dark"];

const AppearanceSelect: FC<Props> = (props: Props) => {
  const { onChange, value, className } = props;
  const { t } = useTranslation();

  const getPrefixIcon = (apperance: Appearance) => {
    const className = "w-4 h-auto";
    if (apperance === "light") {
      return <Icon.Sun className={className} />;
    } else if (apperance === "dark") {
      return <Icon.Moon className={className} />;
    } else {
      return <Icon.Smile className={className} />;
    }
  };

  const handleSelectChange = async (appearance: Appearance) => {
    onChange(appearance);
  };

  return (
    <Select
      className={`!min-w-[10rem] w-auto whitespace-nowrap ${className ?? ""}`}
      value={value}
      onChange={(_, appearance) => {
        if (appearance) {
          handleSelectChange(appearance);
        }
      }}
      startDecorator={getPrefixIcon(value)}
    >
      {appearanceList.map((item) => (
        <Option key={item} value={item} className="whitespace-nowrap">
          {t(`setting.apperance-option.${item}`)}
        </Option>
      ))}
    </Select>
  );
};

export default AppearanceSelect;
