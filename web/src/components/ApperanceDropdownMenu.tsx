import { Option, Select } from "@mui/joy";
import { useTranslation } from "react-i18next";

import Icon from "./Icon";
import { APPERANCE_OPTIONS } from "../helpers/consts";
import useApperance, { Apperance } from "../hooks/useApperance";

const ApperanceDropdownMenu = () => {
  const [apperance, setApperance] = useApperance();
  const { t } = useTranslation();

  const apperanceOptionItems = [
    [
      APPERANCE_OPTIONS[0],
      <>
        <Icon.Feather className="w-4 h-4" />
        <p>{t("setting.apperance-option.follow-system")}</p>
      </>,
    ],
    [
      APPERANCE_OPTIONS[1],
      <>
        <Icon.Sun className="w-4 h-4" />
        <p>{t("setting.apperance-option.always-light")}</p>
      </>,
    ],
    [
      APPERANCE_OPTIONS[2],
      <>
        <Icon.Moon className="w-4 h-4" />
        <p>{t("setting.apperance-option.always-dark")}</p>
      </>,
    ],
  ] as const;

  return (
    <Select
      className="w-56 text-sm"
      value={apperance}
      onChange={(_, value) => {
        setApperance(value as Apperance);
      }}
    >
      {apperanceOptionItems.map((item) => (
        <Option key={item[0]} value={item[0]}>
          <span className="flex items-center gap-2">{item[1]}</span>
        </Option>
      ))}
    </Select>
  );
};

export default ApperanceDropdownMenu;
