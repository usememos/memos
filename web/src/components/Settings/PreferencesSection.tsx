import { Button, Divider, Input, Option, Select, Switch } from "@mui/joy";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { VISIBILITY_SELECTOR_ITEMS } from "@/helpers/consts";
import { useGlobalStore, useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import AppearanceSelect from "../AppearanceSelect";
import LearnMore from "../LearnMore";
import LocaleSelect from "../LocaleSelect";
import "@/less/settings/preferences-section.less";

const PreferencesSection = () => {
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const { appearance, locale } = globalStore.state;
  const { setting, localSetting } = userStore.state.user as User;
  const [telegramUserId, setTelegramUserId] = useState<string>(setting.telegramUserId);
  const visibilitySelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${item.text.toLowerCase() as Lowercase<typeof item.text>}`),
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
    await userStore.upsertUserSetting("memo-visibility", value);
  };

  const handleDoubleClickEnabledChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    userStore.upsertLocalSetting({ ...localSetting, enableDoubleClickEditing: event.target.checked });
  };

  const handleDailyReviewTimeOffsetChanged = (value: number) => {
    userStore.upsertLocalSetting({ ...localSetting, dailyReviewTimeOffset: value });
  };

  const handleAutoCollapseChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    userStore.upsertLocalSetting({ ...localSetting, enableAutoCollapse: event.target.checked });
  };

  const handleSaveTelegramUserId = async () => {
    try {
      await userStore.upsertUserSetting("telegram-user-id", telegramUserId);
      toast.success(t("common.dialog.success"));
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  const handleTelegramUserIdChanged = async (value: string) => {
    setTelegramUserId(value);
  };

  return (
    <div className="section-container preferences-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <div className="form-label selector">
        <span className="text-sm">{t("common.language")}</span>
        <LocaleSelect value={locale} onChange={handleLocaleSelectChange} />
      </div>
      <div className="form-label selector">
        <span className="text-sm">{t("setting.preference-section.theme")}</span>
        <AppearanceSelect value={appearance} onChange={handleAppearanceSelectChange} />
      </div>
      <p className="title-text">{t("setting.preference")}</p>
      <div className="form-label selector">
        <span className="text-sm break-keep text-ellipsis overflow-hidden">{t("setting.preference-section.default-memo-visibility")}</span>
        <Select
          className="!min-w-fit"
          value={setting.memoVisibility}
          onChange={(_, visibility) => {
            if (visibility) {
              handleDefaultMemoVisibilityChanged(visibility);
            }
          }}
        >
          {visibilitySelectorItems.map((item) => (
            <Option key={item.value} value={item.value}>
              {item.text}
            </Option>
          ))}
        </Select>
      </div>
      <div className="form-label selector">
        <span className="text-sm break-keep text-ellipsis overflow-hidden">{t("setting.preference-section.daily-review-time-offset")}</span>
        <span className="w-auto inline-flex">
          <Select
            placeholder="hh"
            className="!min-w-fit"
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
        <span className="text-sm break-keep">{t("setting.preference-section.enable-double-click")}</span>
        <Switch className="ml-2" checked={localSetting.enableDoubleClickEditing} onChange={handleDoubleClickEnabledChanged} />
      </label>

      <label className="form-label selector">
        <span className="normal-text">{t("setting.preference-section.auto-collapse")}</span>
        <Switch className="ml-2" checked={localSetting.enableAutoCollapse} onChange={handleAutoCollapseChanged} />
      </label>

      <Divider className="!mt-3 !my-4" />

      <div className="mb-2 w-full flex flex-row justify-between items-center">
        <div className="w-auto flex items-center">
          <span className="text-sm mr-1">{t("setting.preference-section.telegram-user-id")}</span>
          <LearnMore url="https://usememos.com/docs/integration/telegram-bot" />
        </div>
        <Button onClick={handleSaveTelegramUserId}>{t("common.save")}</Button>
      </div>
      <Input
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        value={telegramUserId}
        onChange={(event) => handleTelegramUserIdChanged(event.target.value)}
        placeholder={t("setting.preference-section.telegram-user-id-placeholder")}
      />
    </div>
  );
};

export default PreferencesSection;
