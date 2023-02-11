import { Select, Switch, Option } from "@mui/joy";
import React from "react";
import { useTranslation } from "react-i18next";
import { useGlobalStore, useUserStore } from "../../store/module";
import { VISIBILITY_SELECTOR_ITEMS, MEMO_DISPLAY_TS_OPTION_SELECTOR_ITEMS } from "../../helpers/consts";
import AppearanceSelect from "../AppearanceSelect";
import LocaleSelect from "../LocaleSelect";
import "../../less/settings/preferences-section.less";

const PreferencesSection = () => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const { appearance, locale } = globalStore.state;
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

  const handleLocaleSelectChange = async (locale: Locale) => {
    await userStore.upsertUserSetting("locale", locale);
    globalStore.setLocale(locale);
  };

  const handleAppearanceSelectChange = async (appearance: Appearance) => {
    await userStore.upsertUserSetting("appearance", appearance);
    globalStore.setAppearance(appearance);
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userStore.upsertUserSetting("memoVisibility", value);
  };

  const handleMemoDisplayTsOptionChanged = async (value: string) => {
    await userStore.upsertUserSetting("memoDisplayTsOption", value);
  };

  const handleIsFoldingEnabledChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    userStore.upsertLocalSetting({ ...localSetting, enableFoldMemo: event.target.checked });
  };

  const handlePowerfulEditorEnabledChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    userStore.upsertLocalSetting({ ...localSetting, enablePowerfulEditor: event.target.checked });
  };

  const handleDoubleClickEnabledChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    userStore.upsertLocalSetting({ ...localSetting, enableDoubleClickEditing: event.target.checked });
  };

  return (
    <div className="section-container preferences-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <div className="form-label selector">
        <span className="normal-text">{t("common.language")}</span>
        <LocaleSelect value={locale} onChange={handleLocaleSelectChange} />
      </div>
      <div className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.theme")}</span>
        <AppearanceSelect value={appearance} onChange={handleAppearanceSelectChange} />
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
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.enable-powerful-editor")}</span>
        <Switch className="ml-2" checked={localSetting.enablePowerfulEditor} onChange={handlePowerfulEditorEnabledChanged} />
      </label>
      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.enable-double-click")}</span>
        <Switch className="ml-2" checked={localSetting.enableDoubleClickEditing} onChange={handleDoubleClickEnabledChanged} />
      </label>
    </div>
  );
};

export default PreferencesSection;
