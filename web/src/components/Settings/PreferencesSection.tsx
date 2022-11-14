import { useTranslation } from "react-i18next";
import Switch from "@mui/joy/Switch";
import { globalService, userService } from "../../services";
import { useAppSelector } from "../../store";
import {
  VISIBILITY_SELECTOR_ITEMS,
  MEMO_DISPLAY_TS_OPTION_SELECTOR_ITEMS,
  SETTING_IS_FOLDING_ENABLED_KEY,
  IS_FOLDING_ENABLED_DEFAULT_VALUE,
} from "../../helpers/consts";
import useLocalStorage from "../../hooks/useLocalStorage";
import Selector from "../common/Selector";
import "../../less/settings/preferences-section.less";

const localeSelectorItems = [
  {
    text: "English",
    value: "en",
  },
  {
    text: "中文",
    value: "zh",
  },
  {
    text: "Tiếng Việt",
    value: "vi",
  },
];

const PreferencesSection = () => {
  const { t } = useTranslation();
  const { setting } = useAppSelector((state) => state.user.user as User);
  const visibilitySelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${item.text.toLowerCase()}`),
    };
  });

  const memoDisplayTsOptionSelectorItems = MEMO_DISPLAY_TS_OPTION_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`setting.preference-section.${item.value}`),
    };
  });

  const [isFoldingEnabled, setIsFoldingEnabled] = useLocalStorage(SETTING_IS_FOLDING_ENABLED_KEY, IS_FOLDING_ENABLED_DEFAULT_VALUE);

  const handleLocaleChanged = async (value: string) => {
    await userService.upsertUserSetting("locale", value);
    globalService.setLocale(value as Locale);
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userService.upsertUserSetting("memoVisibility", value);
  };

  const handleMemoDisplayTsOptionChanged = async (value: string) => {
    await userService.upsertUserSetting("memoDisplayTsOption", value);
  };

  const handleIsFoldingEnabledChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsFoldingEnabled(event.target.checked);
  };

  return (
    <div className="section-container preferences-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <label className="form-label selector">
        <span className="normal-text">{t("common.language")}</span>
        <Selector className="ml-2 w-32" value={setting.locale} dataSource={localeSelectorItems} handleValueChanged={handleLocaleChanged} />
      </label>
      <p className="title-text">{t("setting.preference")}</p>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.default-memo-visibility")}</span>
        <Selector
          className="ml-2 w-32"
          value={setting.memoVisibility}
          dataSource={visibilitySelectorItems}
          handleValueChanged={handleDefaultMemoVisibilityChanged}
        />
      </label>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.fold-memo")}</span>
        <Switch className="ml-2" checked={isFoldingEnabled} onChange={handleIsFoldingEnabledChanged} />
      </label>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.default-memo-sort-option")}</span>
        <Selector
          className="ml-2 w-32"
          value={setting.memoDisplayTsOption}
          dataSource={memoDisplayTsOptionSelectorItems}
          handleValueChanged={handleMemoDisplayTsOptionChanged}
        />
      </label>
    </div>
  );
};

export default PreferencesSection;
