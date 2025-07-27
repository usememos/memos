import { observer } from "mobx-react-lite";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { userStore } from "@/store";
import { Visibility } from "@/types/proto/api/v1/memo_service";
import { UserSetting_GeneralSetting } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString, convertVisibilityToString } from "@/utils/memo";
import AppearanceSelect from "../AppearanceSelect";
import LocaleSelect from "../LocaleSelect";
import ThemeSelector from "../ThemeSelector";
import VisibilityIcon from "../VisibilityIcon";
import WebhookSection from "./WebhookSection";

const PreferencesSection = observer(() => {
  const t = useTranslate();
  const generalSetting = userStore.state.userGeneralSetting;

  const handleLocaleSelectChange = async (locale: Locale) => {
    await userStore.updateUserGeneralSetting({ locale }, ["locale"]);
  };

  const handleAppearanceSelectChange = async (appearance: Appearance) => {
    await userStore.updateUserGeneralSetting({ appearance }, ["appearance"]);
  };

  const handleDefaultMemoVisibilityChanged = async (value: string) => {
    await userStore.updateUserGeneralSetting({ memoVisibility: value }, ["memoVisibility"]);
  };

  const handleThemeChange = async (theme: string) => {
    await userStore.updateUserGeneralSetting({ theme }, ["theme"]);
  };

  // Provide default values if setting is not loaded yet
  const setting: UserSetting_GeneralSetting = generalSetting || {
    locale: "en",
    appearance: "system",
    memoVisibility: "PRIVATE",
    theme: "",
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-muted-foreground">{t("common.basic")}</p>

      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("common.language")}</span>
        <LocaleSelect value={setting.locale} onChange={handleLocaleSelectChange} />
      </div>

      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.preference-section.apperance")}</span>
        <AppearanceSelect value={setting.appearance as Appearance} onChange={handleAppearanceSelectChange} />
      </div>

      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.preference-section.theme")}</span>
        <ThemeSelector value={setting.theme} onValueChange={handleThemeChange} />
      </div>

      <p className="font-medium text-muted-foreground">{t("setting.preference")}</p>

      <div className="w-full flex flex-row justify-between items-center">
        <span className="truncate">{t("setting.preference-section.default-memo-visibility")}</span>
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
      </div>

      <Separator className="my-3" />

      <WebhookSection />
    </div>
  );
});

export default PreferencesSection;
