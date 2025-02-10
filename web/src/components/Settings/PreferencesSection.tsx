import { Divider, Option, Select } from "@mui/joy";
import { observer } from "mobx-react-lite";
import { userStore } from "@/store/v2";
import { Visibility } from "@/types/proto/api/v1/memo_service";
import { UserSetting } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString, convertVisibilityToString } from "@/utils/memo";
import AppearanceSelect from "../AppearanceSelect";
import LocaleSelect from "../LocaleSelect";
import VisibilityIcon from "../VisibilityIcon";
import WebhookSection from "./WebhookSection";

const PreferencesSection = observer(() => {
  const t = useTranslate();
  const setting = userStore.state.userSetting as UserSetting;

  const handleLocaleSelectChange = async (locale: Locale) => {
    await userStore.updateUserSetting(
      {
        locale,
      },
      ["locale"],
    );
  };

  const handleAppearanceSelectChange = async (appearance: Appearance) => {
    await userStore.updateUserSetting(
      {
        appearance,
      },
      ["appearance"],
    );
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userStore.updateUserSetting(
      {
        memoVisibility: value,
      },
      ["memo_visibility"],
    );
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-gray-700 dark:text-gray-500">{t("common.basic")}</p>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("common.language")}</span>
        <LocaleSelect value={setting.locale} onChange={handleLocaleSelectChange} />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.preference-section.theme")}</span>
        <AppearanceSelect value={setting.appearance as Appearance} onChange={handleAppearanceSelectChange} />
      </div>
      <p className="font-medium text-gray-700 dark:text-gray-500">{t("setting.preference")}</p>
      <div className="w-full flex flex-row justify-between items-center">
        <span className="truncate">{t("setting.preference-section.default-memo-visibility")}</span>
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

      <Divider className="!my-3" />

      <WebhookSection />
    </div>
  );
});

export default PreferencesSection;
