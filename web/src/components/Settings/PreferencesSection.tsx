import { Select, Switch, Option } from "@mui/joy";
import React from "react";
import { useTranslation } from "react-i18next";
import { useGlobalStore, useUserStore } from "../../store/module";
import { VISIBILITY_SELECTOR_ITEMS } from "../../helpers/consts";
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

  const dailyReviewTimeOffsetOptions: number[] = [...Array(24).keys()];

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

  const handleDefaultResourceVisibilityChanged = async (value: string) => {
    await userStore.upsertUserSetting("resourceVisibility", value);
  };

  const handleDoubleClickEnabledChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    userStore.upsertLocalSetting({ ...localSetting, enableDoubleClickEditing: event.target.checked });
  };

  const handleDailyReviewTimeOffsetChanged = (value: number) => {
    userStore.upsertLocalSetting({ ...localSetting, dailyReviewTimeOffset: value });
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
      <div className="form-label selector">
        <span className="normal-text">Default resource visibility</span>
        <Select
          className="!min-w-[10rem] w-auto text-sm"
          value={setting.resourceVisibility}
          onChange={(_, visibility) => {
            if (visibility) {
              handleDefaultResourceVisibilityChanged(visibility);
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

      <div className="form-label selector">
        <span className="normal-text">Daily Review Time Offset</span>
        <span className="w-auto inline-flex">
          <Select
            placeholder="hh"
            className="!min-w-[4rem] w-auto text-sm"
            value={localSetting.dailyReviewTimeOffset}
            onChange={(_, value) => {
              if (value !== null) {
                handleDailyReviewTimeOffsetChanged(value);
              }
            }}
            slotProps={{
              listbox: {
                sx: {
                  maxHeight: "15rem",
                  overflow: "auto",
                },
              },
            }}
          >
            {dailyReviewTimeOffsetOptions.map((item) => (
              <Option key={item} value={item} className="whitespace-nowrap">
                {item.toString().padStart(2, "0")}
              </Option>
            ))}
          </Select>
        </span>
      </div>

      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.enable-double-click")}</span>
        <Switch className="ml-2" checked={localSetting.enableDoubleClickEditing} onChange={handleDoubleClickEnabledChanged} />
      </label>
    </div>
  );
};

export default PreferencesSection;
