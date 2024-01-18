import { Option, Select } from "@mui/joy";
import { useState } from "react";
import Icon from "@/components/Icon";
import MobileHeader from "@/components/MobileHeader";
import MemberSection from "@/components/Settings/MemberSection";
import MyAccountSection from "@/components/Settings/MyAccountSection";
import PreferencesSection from "@/components/Settings/PreferencesSection";
import SSOSection from "@/components/Settings/SSOSection";
import StorageSection from "@/components/Settings/StorageSection";
import SystemSection from "@/components/Settings/SystemSection";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useGlobalStore } from "@/store/module";
import { User_Role } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";

type SettingSection = "my-account" | "preference" | "member" | "system" | "storage" | "sso";

interface State {
  selectedSection: SettingSection;
}

const Setting = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const globalStore = useGlobalStore();
  const [state, setState] = useState<State>({
    selectedSection: "my-account",
  });
  const isHost = user.role === User_Role.HOST;

  const handleSectionSelectorItemClick = (settingSection: SettingSection) => {
    setState({
      selectedSection: settingSection,
    });
  };

  const getSettingSectionList = () => {
    let settingList: SettingSection[] = ["my-account", "preference"];
    if (isHost) {
      settingList = settingList.concat(["member", "system", "storage", "sso"]);
    }
    return settingList;
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6">
        <div className="w-full shadow flex flex-row justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
          <div className="hidden sm:flex flex-col justify-start items-start w-40 h-auto shrink-0 py-2">
            <span className="text-sm mt-0.5 pl-3 font-mono text-gray-400 dark:text-gray-500">{t("common.basic")}</span>
            <div className="w-full flex flex-col justify-start items-start mt-1">
              <span
                className={`w-auto px-3 leading-8 flex flex-row justify-start items-center cursor-pointer rounded-lg hover:opacity-80 ${
                  state.selectedSection === "my-account" ? "bg-zinc-100 shadow dark:bg-zinc-900" : ""
                }`}
                onClick={() => handleSectionSelectorItemClick("my-account")}
              >
                <Icon.User className="w-4 h-auto mr-2 opacity-80" /> {t("setting.my-account")}
              </span>
              <span
                className={`w-auto px-3 leading-8 flex flex-row justify-start items-center cursor-pointer rounded-lg hover:opacity-80 ${
                  state.selectedSection === "preference" ? "bg-zinc-100 shadow dark:bg-zinc-900" : ""
                }`}
                onClick={() => handleSectionSelectorItemClick("preference")}
              >
                <Icon.Cog className="w-4 h-auto mr-2 opacity-80" /> {t("setting.preference")}
              </span>
            </div>
            {isHost ? (
              <>
                <span className="text-sm mt-4 pl-3 font-mono text-gray-400 dark:text-gray-500">{t("common.admin")}</span>
                <div className="w-full flex flex-col justify-start items-start mt-1">
                  <span
                    onClick={() => handleSectionSelectorItemClick("member")}
                    className={`w-auto px-3 leading-8 flex flex-row justify-start items-center cursor-pointer rounded-lg hover:opacity-80 ${
                      state.selectedSection === "member" ? "bg-zinc-100 shadow dark:bg-zinc-900" : ""
                    }`}
                  >
                    <Icon.Users className="w-4 h-auto mr-2 opacity-80" /> {t("setting.member")}
                  </span>
                  <span
                    onClick={() => handleSectionSelectorItemClick("system")}
                    className={`w-auto px-3 leading-8 flex flex-row justify-start items-center cursor-pointer rounded-lg hover:opacity-80 ${
                      state.selectedSection === "system" ? "bg-zinc-100 shadow dark:bg-zinc-900" : ""
                    }`}
                  >
                    <Icon.Settings2 className="w-4 h-auto mr-2 opacity-80" /> {t("setting.system")}
                  </span>
                  <span
                    onClick={() => handleSectionSelectorItemClick("storage")}
                    className={`w-auto px-3 leading-8 flex flex-row justify-start items-center cursor-pointer rounded-lg hover:opacity-80 ${
                      state.selectedSection === "storage" ? "bg-zinc-100 shadow dark:bg-zinc-900" : ""
                    }`}
                  >
                    <Icon.Database className="w-4 h-auto mr-2 opacity-80" /> {t("setting.storage")}
                  </span>
                  <span
                    onClick={() => handleSectionSelectorItemClick("sso")}
                    className={`w-auto px-3 leading-8 flex flex-row justify-start items-center cursor-pointer rounded-lg hover:opacity-80 ${
                      state.selectedSection === "sso" ? "bg-zinc-100 shadow dark:bg-zinc-900" : ""
                    }`}
                  >
                    <Icon.Key className="w-4 h-auto mr-2 opacity-80" /> {t("setting.sso")}
                  </span>
                  <span className="px-3 mt-2 opacity-70 text-sm">Version: v{globalStore.state.systemStatus.profile.version}</span>
                </div>
              </>
            ) : null}
          </div>
          <div className="w-full grow sm:pl-4 overflow-x-auto">
            <div className="w-auto inline-block my-2 sm:hidden">
              <Select value={state.selectedSection} onChange={(_, value) => handleSectionSelectorItemClick(value as SettingSection)}>
                {getSettingSectionList().map((settingSection) => (
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
              <SystemSection />
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
