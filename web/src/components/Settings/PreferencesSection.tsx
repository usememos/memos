import { Select, Switch, Option } from "@mui/joy";
import { useTranslation } from "react-i18next";
import { useGlobalStore, useUserStore } from "../../store/module";
import { VISIBILITY_SELECTOR_ITEMS, MEMO_DISPLAY_TS_OPTION_SELECTOR_ITEMS } from "../../helpers/consts";
import Icon from "../Icon";
import AppearanceSelect from "../AppearanceSelect";
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
  {
    text: "French",
    value: "fr",
  },
  {
    text: "Nederlands",
    value: "nl",
  },
  {
    text: "Svenska",
    value: "sv",
  },
  {
    text: "German",
    value: "de",
  },
  {
    text: "Español",
    value: "es",
  },
];

const PreferencesSection = () => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const { setting, localSetting } = userStore.state.user as User;
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

  const handleLocaleChanged = async (value: string) => {
    await userStore.upsertUserSetting("locale", value);
    globalStore.setLocale(value as Locale);
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userStore.upsertUserSetting("memoVisibility", value);
  };

  const handleMemoDisplayTsOptionChanged = async (value: string) => {
    await userStore.upsertUserSetting("memoDisplayTsOption", value);
  };

  const handleIsFoldingEnabledChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    userStore.upsertLocalSetting("enableFoldMemo", event.target.checked);
  };

  return (
    <div className="section-container preferences-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <div className="form-label selector">
        <span className="normal-text">{t("common.language")}</span>
        <Select
          className="!min-w-[10rem] w-auto text-sm"
          value={setting.locale}
          onChange={(_, locale) => {
            if (locale) {
              handleLocaleChanged(locale);
            }
          }}
          startDecorator={<Icon.Globe className="w-4 h-auto" />}
        >
          {localeSelectorItems.map((item) => (
            <Option key={item.value} value={item.value} className="whitespace-nowrap">
              {item.text}
            </Option>
          ))}
        </Select>
      </div>
      <div className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.theme")}</span>
        <AppearanceSelect />
      </div>
      <p className="title-text">{t("setting.preference")}</p>
      <div className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.default-memo-visibility")}</span>
        <Select
          className="!min-w-[10rem] w-auto text-sm"
          value={setting.memoVisibility}
          onChange={(_, visibility) => {
            if (visibility) {
              handleDefaultMemoVisibilityChanged(visibility);
            }
          }}
        >
          {visibilitySelectorItems.map((item) => (
            <Option key={item.value} value={item.value} className="whitespace-nowrap">
              {item.text}
            </Option>
          ))}
        </Select>
      </div>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.default-memo-sort-option")}</span>
        <Select
          className="!min-w-[10rem] w-auto text-sm"
          value={setting.memoDisplayTsOption}
          onChange={(_, value) => {
            if (value) {
              handleMemoDisplayTsOptionChanged(value);
            }
          }}
        >
          {memoDisplayTsOptionSelectorItems.map((item) => (
            <Option key={item.value} value={item.value} className="whitespace-nowrap">
              {item.text}
            </Option>
          ))}
        </Select>
      </label>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.enable-folding-memo")}</span>
        <Switch className="ml-2" checked={localSetting.enableFoldMemo} onChange={handleIsFoldingEnabledChanged} />
      </label>
    </div>
  );
};

export default PreferencesSection;
