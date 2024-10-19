import { Option, Select } from "@mui/joy";
import { CogIcon, DatabaseIcon, KeyIcon, LibraryIcon, LucideIcon, Settings2Icon, UserIcon, UsersIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import MobileHeader from "@/components/MobileHeader";
import MemberSection from "@/components/Settings/MemberSection";
import MemoRelatedSettings from "@/components/Settings/MemoRelatedSettings";
import MyAccountSection from "@/components/Settings/MyAccountSection";
import PreferencesSection from "@/components/Settings/PreferencesSection";
import SSOSection from "@/components/Settings/SSOSection";
import SectionMenuItem from "@/components/Settings/SectionMenuItem";
import StorageSection from "@/components/Settings/StorageSection";
import WorkspaceSection from "@/components/Settings/WorkspaceSection";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useCommonContext } from "@/layouts/CommonContextProvider";
import { useWorkspaceSettingStore } from "@/store/v1";
import { User_Role } from "@/types/proto/api/v1/user_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";

type SettingSection = "my-account" | "preference" | "member" | "system" | "memo-related" | "storage" | "sso";

interface State {
  selectedSection: SettingSection;
}

const BASIC_SECTIONS: SettingSection[] = ["my-account", "preference"];
const ADMIN_SECTIONS: SettingSection[] = ["member", "system", "memo-related", "storage", "sso"];
const SECTION_ICON_MAP: Record<SettingSection, LucideIcon> = {
  "my-account": UserIcon,
  preference: CogIcon,
  member: UsersIcon,
  system: Settings2Icon,
  "memo-related": LibraryIcon,
  storage: DatabaseIcon,
  sso: KeyIcon,
};

const Setting = () => {
  const t = useTranslate();
  const location = useLocation();
  const commonContext = useCommonContext();
  const user = useCurrentUser();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const [state, setState] = useState<State>({
    selectedSection: "my-account",
  });
  const isHost = user.role === User_Role.HOST;

  const settingsSectionList = useMemo(() => {
    let settingList = [...BASIC_SECTIONS];
    if (isHost) {
      settingList = settingList.concat(ADMIN_SECTIONS);
    }
    return settingList;
  }, [isHost]);

  useEffect(() => {
    let hash = location.hash.slice(1) as SettingSection;
    // If the hash is not a valid section, redirect to the default section.
    if (![...BASIC_SECTIONS, ...ADMIN_SECTIONS].includes(hash)) {
      hash = "my-account";
    }
    setState({
      selectedSection: hash,
    });
  }, [location.hash]);

  useEffect(() => {
    if (!isHost) {
      return;
    }

    // Initial fetch for workspace settings.
    (async () => {
      [WorkspaceSettingKey.MEMO_RELATED, WorkspaceSettingKey.STORAGE].forEach(async (key) => {
        await workspaceSettingStore.fetchWorkspaceSetting(key);
      });
    })();
  }, [isHost]);

  const handleSectionSelectorItemClick = useCallback((settingSection: SettingSection) => {
    window.location.hash = settingSection;
  }, []);

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="w-full shadow flex flex-row justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
          <div className="hidden sm:flex flex-col justify-start items-start w-40 h-auto shrink-0 py-2">
            <span className="text-sm mt-0.5 pl-3 font-mono select-none text-gray-400 dark:text-gray-500">{t("common.basic")}</span>
            <div className="w-full flex flex-col justify-start items-start mt-1">
              {BASIC_SECTIONS.map((item) => (
                <SectionMenuItem
                  key={item}
                  text={t(`setting.${item}`)}
                  icon={SECTION_ICON_MAP[item]}
                  isSelected={state.selectedSection === item}
                  onClick={() => handleSectionSelectorItemClick(item)}
                />
              ))}
            </div>
            {isHost ? (
              <>
                <span className="text-sm mt-4 pl-3 font-mono select-none text-gray-400 dark:text-gray-500">{t("common.admin")}</span>
                <div className="w-full flex flex-col justify-start items-start mt-1">
                  {ADMIN_SECTIONS.map((item) => (
                    <SectionMenuItem
                      key={item}
                      text={t(`setting.${item}`)}
                      icon={SECTION_ICON_MAP[item]}
                      isSelected={state.selectedSection === item}
                      onClick={() => handleSectionSelectorItemClick(item)}
                    />
                  ))}
                  <span className="px-3 mt-2 opacity-70 text-sm">Version: v{commonContext.profile.version}</span>
                </div>
              </>
            ) : null}
          </div>
          <div className="w-full grow sm:pl-4 overflow-x-auto">
            <div className="w-auto inline-block my-2 sm:hidden">
              <Select value={state.selectedSection} onChange={(_, value) => handleSectionSelectorItemClick(value as SettingSection)}>
                {settingsSectionList.map((settingSection) => (
                  <Option key={settingSection} value={settingSection}>
                    {t(`setting.${settingSection}`)}
                  </Option>
                ))}
              </Select>
            </div>
            {state.selectedSection === "my-account" ? (
              <MyAccountSection />
            ) : state.selectedSection === "preference" ? (
              <PreferencesSection />
            ) : state.selectedSection === "member" ? (
              <MemberSection />
            ) : state.selectedSection === "system" ? (
              <WorkspaceSection />
            ) : state.selectedSection === "memo-related" ? (
              <MemoRelatedSettings />
            ) : state.selectedSection === "storage" ? (
              <StorageSection />
            ) : state.selectedSection === "sso" ? (
              <SSOSection />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Setting;
