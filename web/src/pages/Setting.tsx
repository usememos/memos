import {
  CogIcon,
  DatabaseIcon,
  HeartHandshakeIcon,
  KeyIcon,
  LibraryIcon,
  LucideIcon,
  Settings2Icon,
  TagsIcon,
  UserIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import MobileHeader from "@/components/MobileHeader";
import AISection from "@/components/Settings/AISection";
import InstanceSection from "@/components/Settings/InstanceSection";
import MemberSection from "@/components/Settings/MemberSection";
import MemoRelatedSettings from "@/components/Settings/MemoRelatedSettings";
import MyAccountSection from "@/components/Settings/MyAccountSection";
import PreferencesSection from "@/components/Settings/PreferencesSection";
import SectionMenuItem from "@/components/Settings/SectionMenuItem";
import SSOSection from "@/components/Settings/SSOSection";
import StorageSection from "@/components/Settings/StorageSection";
import TagsSection from "@/components/Settings/TagsSection";
import WebhookSection from "@/components/Settings/WebhookSection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
import { User_Role } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

type SettingSection = "my-account" | "preference" | "webhook" | "member" | "system" | "memo" | "storage" | "sso" | "tags" | "ai";

const BASIC_SECTIONS: SettingSection[] = ["my-account", "preference", "webhook"];
const ADMIN_SECTIONS: SettingSection[] = ["member", "system", "memo", "tags", "storage", "sso", "ai"];

const SECTION_ICON_MAP: Record<SettingSection, LucideIcon> = {
  "my-account": UserIcon,
  preference: CogIcon,
  webhook: WebhookIcon,
  member: UsersIcon,
  system: Settings2Icon,
  memo: LibraryIcon,
  storage: DatabaseIcon,
  tags: TagsIcon,
  sso: KeyIcon,
  ai: HeartHandshakeIcon,
};

const SECTION_COMPONENT_MAP: Record<SettingSection, React.ComponentType> = {
  "my-account": MyAccountSection,
  preference: PreferencesSection,
  webhook: WebhookSection,
  member: MemberSection,
  system: InstanceSection,
  memo: MemoRelatedSettings,
  storage: StorageSection,
  tags: TagsSection,
  sso: SSOSection,
  ai: AISection,
};

const Setting = () => {
  const t = useTranslate();
  const sm = useMediaQuery("sm");
  const location = useLocation();
  const user = useCurrentUser();
  const { profile, fetchSetting } = useInstance();
  const [selectedSection, setSelectedSection] = useState<SettingSection>("my-account");
  const isHost = user?.role === User_Role.ADMIN;

  const settingsSectionList = useMemo(() => {
    return isHost ? [...BASIC_SECTIONS, ...ADMIN_SECTIONS] : [...BASIC_SECTIONS];
  }, [isHost]);

  useEffect(() => {
    const hash = location.hash.slice(1) as SettingSection;
    const nextSection = settingsSectionList.includes(hash) ? hash : "my-account";
    setSelectedSection(nextSection);
  }, [location.hash, settingsSectionList]);

  useEffect(() => {
    if (!isHost) {
      return;
    }
    // Fetch admin-only settings that are not eagerly loaded by InstanceContext.
    fetchSetting(InstanceSetting_Key.STORAGE);
    fetchSetting(InstanceSetting_Key.TAGS);
    fetchSetting(InstanceSetting_Key.AI);
  }, [isHost, fetchSetting]);

  const handleSectionSelectorItemClick = (section: SettingSection) => {
    window.location.hash = section;
  };

  const ActiveSection = SECTION_COMPONENT_MAP[selectedSection];

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      {!sm && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-border flex flex-row justify-start items-start px-4 py-3 rounded-xl bg-background text-muted-foreground">
          {sm && (
            <div className="flex flex-col justify-start items-start w-40 h-auto shrink-0 py-2">
              <span className="text-sm mt-0.5 pl-3 font-mono select-none text-muted-foreground">{t("common.basic")}</span>
              <div className="w-full flex flex-col justify-start items-start mt-1">
                {BASIC_SECTIONS.map((item) => (
                  <SectionMenuItem
                    key={item}
                    text={t(`setting.${item}.label`)}
                    icon={SECTION_ICON_MAP[item]}
                    isSelected={selectedSection === item}
                    onClick={() => handleSectionSelectorItemClick(item)}
                  />
                ))}
              </div>
              {isHost && (
                <>
                  <span className="text-sm mt-4 pl-3 font-mono select-none text-muted-foreground">{t("common.admin")}</span>
                  <div className="w-full flex flex-col justify-start items-start mt-1">
                    {ADMIN_SECTIONS.map((item) => (
                      <SectionMenuItem
                        key={item}
                        text={t(`setting.${item}.label`)}
                        icon={SECTION_ICON_MAP[item]}
                        isSelected={selectedSection === item}
                        onClick={() => handleSectionSelectorItemClick(item)}
                      />
                    ))}
                    <span className="px-3 mt-2 opacity-70 text-sm">
                      {t("setting.version")}: v{profile.version}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="w-full grow sm:pl-4 overflow-x-auto">
            {!sm && (
              <div className="w-auto inline-block my-2">
                <Select value={selectedSection} onValueChange={(value) => handleSectionSelectorItemClick(value as SettingSection)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {settingsSectionList.map((section) => (
                      <SelectItem key={section} value={section}>
                        {t(`setting.${section}.label`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <ActiveSection />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Setting;
