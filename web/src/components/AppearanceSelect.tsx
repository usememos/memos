import { Option, Select } from "@mui/joy";
import { useTranslation } from "react-i18next";
import { useGlobalStore, useUserStore } from "../store/module";
import Icon from "./Icon";

const appearanceList = ["system", "light", "dark"];

const AppearanceSelect = () => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const { appearance } = globalStore.state;
  const user = userStore.state.user;

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
    if (user) {
      await userStore.upsertUserSetting("appearance", appearance);
    }
    globalStore.setAppearance(appearance);
  };

  return (
    <Select
      className="!min-w-[10rem] w-auto text-sm"
      value={appearance}
      onChange={(_, appearance) => {
        if (appearance) {
          handleSelectChange(appearance);
        }
      }}
      startDecorator={getPrefixIcon(appearance)}
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
