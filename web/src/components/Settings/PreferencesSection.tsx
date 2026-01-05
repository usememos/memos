import { create } from "@bufbuild/protobuf";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateUserGeneralSetting } from "@/hooks/useUserQueries";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { UserSetting_GeneralSetting, UserSetting_GeneralSettingSchema } from "@/types/proto/api/v1/user_service_pb";
import { loadLocale, useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString, convertVisibilityToString } from "@/utils/memo";
import { loadTheme } from "@/utils/theme";
import LocaleSelect from "../LocaleSelect";
import ThemeSelect from "../ThemeSelect";
import VisibilityIcon from "../VisibilityIcon";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";
import WebhookSection from "./WebhookSection";

const PreferencesSection = () => {
  const t = useTranslate();
  const { currentUser, userGeneralSetting: generalSetting, refetchSettings } = useAuth();
  const { mutate: updateUserGeneralSetting } = useUpdateUserGeneralSetting(currentUser?.name);

  const handleLocaleSelectChange = async (locale: Locale) => {
    // Apply locale immediately for instant UI feedback and persist to localStorage
    loadLocale(locale);
    // Persist to user settings
    updateUserGeneralSetting(
      { generalSetting: { locale }, updateMask: ["locale"] },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  const handleDefaultMemoVisibilityChanged = (value: string) => {
    updateUserGeneralSetting(
      { generalSetting: { memoVisibility: value }, updateMask: ["memo_visibility"] },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  const handleThemeChange = async (theme: string) => {
    // Apply theme immediately for instant UI feedback
    loadTheme(theme);
    // Persist to user settings
    updateUserGeneralSetting(
      { generalSetting: { theme }, updateMask: ["theme"] },
      {
        onSuccess: () => {
          refetchSettings();
        },
      },
    );
  };

  // Provide default values if setting is not loaded yet
  const setting: UserSetting_GeneralSetting =
    generalSetting ||
    create(UserSetting_GeneralSettingSchema, {
      locale: "en",
      memoVisibility: "PRIVATE",
      theme: "system",
    });

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
          <Select value={setting.memoVisibility || "PRIVATE"} onValueChange={handleDefaultMemoVisibilityChanged}>
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
};

export default PreferencesSection;
