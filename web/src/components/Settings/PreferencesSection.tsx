import { observer } from "mobx-react-lite";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { instanceStore, userStore } from "@/store";
import { Visibility } from "@/types/proto/api/v1/memo_service";
import { UserSetting_GeneralSetting } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString, convertVisibilityToString } from "@/utils/memo";
import LocaleSelect from "../LocaleSelect";
import ThemeSelect from "../ThemeSelect";
import VisibilityIcon from "../VisibilityIcon";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";
import WebhookSection from "./WebhookSection";

const PreferencesSection = observer(() => {
  const t = useTranslate();
  const generalSetting = userStore.state.userGeneralSetting;

  const handleLocaleSelectChange = async (locale: Locale) => {
    // Update instance store immediately for instant UI feedback
    instanceStore.state.setPartial({ locale });
    // Persist to user settings
    await userStore.updateUserGeneralSetting({ locale }, ["locale"]);
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userStore.updateUserGeneralSetting({ memoVisibility: value }, ["memoVisibility"]);
  };

  const handleThemeChange = async (theme: string) => {
    // Update instance store immediately for instant UI feedback
    instanceStore.state.setPartial({ theme });
    // Persist to user settings
    await userStore.updateUserGeneralSetting({ theme }, ["theme"]);
  };

  // Provide default values if setting is not loaded yet
  const setting: UserSetting_GeneralSetting = generalSetting || {
    locale: "en",
    memoVisibility: "PRIVATE",
    theme: "system",
  };

  return (
    <SettingSection>
      <SettingGroup title={t("common.basic")}>
        <SettingRow label={t("common.language")}>
          <LocaleSelect value={setting.locale} onChange={handleLocaleSelectChange} />
        </SettingRow>

        <SettingRow label={t("setting.preference-section.theme")}>
          <ThemeSelect value={setting.theme} onValueChange={handleThemeChange} />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("setting.preference")} showSeparator>
        <SettingRow label={t("setting.preference-section.default-memo-visibility")}>
          <Select value={setting.memoVisibility} onValueChange={handleDefaultMemoVisibilityChanged}>
            <SelectTrigger className="min-w-fit">
              <div className="flex items-center gap-2">
                <VisibilityIcon visibility={convertVisibilityFromString(setting.memoVisibility)} />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {[Visibility.PRIVATE, Visibility.PROTECTED, Visibility.PUBLIC]
                .map((v) => convertVisibilityToString(v))
                .map((item) => (
                  <SelectItem key={item} value={item} className="whitespace-nowrap">
                    {t(`memo.visibility.${item.toLowerCase() as Lowercase<typeof item>}`)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingGroup>

      <SettingGroup showSeparator>
        <WebhookSection />
      </SettingGroup>
    </SettingSection>
  );
});

export default PreferencesSection;
