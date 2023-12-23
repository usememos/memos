import { Button, Divider, Input, Option, Select } from "@mui/joy";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { useGlobalStore } from "@/store/module";
import { useUserStore } from "@/store/v1";
import { Visibility } from "@/types/proto/api/v2/memo_service";
import { UserSetting } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString, convertVisibilityToString } from "@/utils/memo";
import AppearanceSelect from "../AppearanceSelect";
import Icon from "../Icon";
import LocaleSelect from "../LocaleSelect";
import VisibilityIcon from "../VisibilityIcon";
import WebhookSection from "./WebhookSection";
import "@/less/settings/preferences-section.less";

const PreferencesSection = () => {
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const { appearance, locale } = globalStore.state;
  const setting = userStore.userSetting as UserSetting;
  const [telegramUserId, setTelegramUserId] = useState<string>(setting.telegramUserId);

  const handleLocaleSelectChange = async (locale: Locale) => {
    await userStore.updateUserSetting(
      {
        locale,
      },
      ["locale"]
    );
    globalStore.setLocale(locale);
  };

  const handleAppearanceSelectChange = async (appearance: Appearance) => {
    await userStore.updateUserSetting(
      {
        appearance,
      },
      ["appearance"]
    );
    globalStore.setAppearance(appearance);
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userStore.updateUserSetting(
      {
        memoVisibility: value,
      },
      ["memo_visibility"]
    );
  };

  const handleSaveTelegramUserId = async () => {
    try {
      await userStore.updateUserSetting(
        {
          telegramUserId: telegramUserId,
        },
        ["telegram_user_id"]
      );
      toast.success(t("message.update-succeed"));
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
          startDecorator={<VisibilityIcon visibility={convertVisibilityFromString(setting.memoVisibility)} />}
          onChange={(_, visibility) => {
            if (visibility) {
              handleDefaultMemoVisibilityChanged(visibility);
            }
          }}
        >
          {[Visibility.PRIVATE, Visibility.PROTECTED, Visibility.PUBLIC]
            .map((v) => convertVisibilityToString(v))
            .map((item) => (
              <Option key={item} value={item} className="whitespace-nowrap">
                {t(`memo.visibility.${item.toLowerCase() as Lowercase<typeof item>}`)}
              </Option>
            ))}
        </Select>
      </div>

      <Divider className="!mt-3 !my-4" />

      <div className="w-full flex flex-col justify-start items-start">
        <div className="mb-2 w-full flex flex-row justify-between items-center">
          <div className="w-auto flex items-center">
            <span className="text-sm mr-1">{t("setting.preference-section.telegram-user-id")}</span>
          </div>
          <Button variant="outlined" color="neutral" onClick={handleSaveTelegramUserId}>
            {t("common.save")}
          </Button>
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
        <div className="w-full">
          <Link
            className="text-gray-500 text-sm inline-flex flex-row justify-start items-center mt-2 hover:underline hover:text-blue-600"
            to="https://usememos.com/docs/integration/telegram-bot"
            target="_blank"
          >
            {t("common.learn-more")}
            <Icon.ExternalLink className="inline w-4 h-auto ml-1" />
          </Link>
        </div>
      </div>

      <Divider className="!my-4" />

      <WebhookSection />
    </div>
  );
};

export default PreferencesSection;
