import { Option, Select } from "@mui/joy";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";
import { APPERANCE_OPTIONS } from "../helpers/consts";
import useApperance, { Apperance } from "../hooks/useApperance";

const ApperanceSelect = () => {
  const [apperance, setApperance] = useApperance();
  const { t } = useTranslation();

  const getPrefixIcon = (apperance: Apperance) => {
    const className = "w-4 h-auto";
    if (apperance === "light") {
      return <Icon.Sun className={className} />;
    } else if (apperance === "dark") {
      return <Icon.Moon className={className} />;
    } else {
      return <Icon.Smile className={className} />;
    }
  };

  return (
    <Select
      className="!min-w-[12rem] w-auto text-sm"
      value={apperance}
      onChange={(_, value) => {
        setApperance(value as Apperance);
      }}
      startDecorator={getPrefixIcon(apperance)}
    >
      {APPERANCE_OPTIONS.map((item) => (
        <Option key={item} value={item} className="whitespace-nowrap">
          {t(`setting.apperance-option.${item}`)}
        </Option>
      ))}
    </Select>
  );
};

export default ApperanceSelect;
