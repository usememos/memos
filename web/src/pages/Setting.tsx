import { Option, Select } from "@mui/joy";
import { useState } from "react";
import BetaBadge from "@/components/BetaBadge";
import Icon from "@/components/Icon";
import MobileHeader from "@/components/MobileHeader";
import MemberSection from "@/components/Settings/MemberSection";
import MyAccountSection from "@/components/Settings/MyAccountSection";
import OpenAISection from "@/components/Settings/OpenAISection";
import PreferencesSection from "@/components/Settings/PreferencesSection";
import SSOSection from "@/components/Settings/SSOSection";
import StorageSection from "@/components/Settings/StorageSection";
import SystemSection from "@/components/Settings/SystemSection";
import { useGlobalStore, useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import "@/less/setting.less";

type SettingSection = "my-account" | "preference" | "member" | "system" | "openai" | "storage" | "sso";

interface State {
  selectedSection: SettingSection;
}

const Setting = () => {
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const user = userStore.state.user;
  const [state, setState] = useState<State>({
    selectedSection: "my-account",
  });
  const isHost = user?.role === "HOST";

  const handleSectionSelectorItemClick = (settingSection: SettingSection) => {
    setState({
      selectedSection: settingSection,
    });
  };

  const getSettingSectionList = () => {
    let settingList: SettingSection[] = ["my-account", "preference"];
    if (isHost) {
      if (globalStore.isDev()) {
        settingList = settingList.concat(["member", "system", "openai", "storage", "sso"]);
      } else {
        settingList = settingList.concat(["member", "system", "storage", "sso"]);
      }
    }
    return settingList;
  };

  return (
    <section className="w-full min-h-full flex flex-col md:flex-row justify-start items-start px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="setting-page-wrapper">
        <div className="section-selector-container">
          <span className="section-title">{t("common.basic")}</span>
          <div className="section-items-container">
            <span
              onClick={() => handleSectionSelectorItemClick("my-account")}
              className={`section-item ${state.selectedSection === "my-account" ? "selected" : ""}`}
            >
              <Icon.User className="w-4 h-auto mr-2 opacity-80" /> {t("setting.my-account")}
            </span>
            <span
              onClick={() => handleSectionSelectorItemClick("preference")}
              className={`section-item ${state.selectedSection === "preference" ? "selected" : ""}`}
            >
              <Icon.Cog className="w-4 h-auto mr-2 opacity-80" /> {t("setting.preference")}
            </span>
          </div>
          {isHost ? (
            <>
              <span className="section-title">{t("common.admin")}</span>
              <div className="section-items-container">
                <span
                  onClick={() => handleSectionSelectorItemClick("member")}
                  className={`section-item ${state.selectedSection === "member" ? "selected" : ""}`}
                >
                  <Icon.Users className="w-4 h-auto mr-2 opacity-80" /> {t("setting.member")}
                </span>
                <span
                  onClick={() => handleSectionSelectorItemClick("system")}
                  className={`section-item ${state.selectedSection === "system" ? "selected" : ""}`}
                >
                  <Icon.Settings2 className="w-4 h-auto mr-2 opacity-80" /> {t("setting.system")}
                </span>
                {globalStore.isDev() && (
                  <span
                    onClick={() => handleSectionSelectorItemClick("openai")}
                    className={`section-item ${state.selectedSection === "openai" ? "selected" : ""}`}
                  >
                    <Icon.Bot className="w-4 h-auto mr-2 opacity-80" /> {t("setting.openai")} <BetaBadge />
                  </span>
                )}
                <span
                  onClick={() => handleSectionSelectorItemClick("storage")}
                  className={`section-item ${state.selectedSection === "storage" ? "selected" : ""}`}
                >
                  <Icon.Database className="w-4 h-auto mr-2 opacity-80" /> {t("setting.storage")} <BetaBadge />
                </span>
                <span
                  onClick={() => handleSectionSelectorItemClick("sso")}
                  className={`section-item ${state.selectedSection === "sso" ? "selected" : ""}`}
                >
                  <Icon.Key className="w-4 h-auto mr-2 opacity-80" /> {t("setting.sso")} <BetaBadge />
                </span>
              </div>
            </>
          ) : null}
        </div>
        <div className="section-content-container">
          <Select
            className="block mb-2 sm:!hidden"
            value={state.selectedSection}
            onChange={(_, value) => handleSectionSelectorItemClick(value as SettingSection)}
          >
            {getSettingSectionList().map((settingSection) => (
              <Option key={settingSection} value={settingSection}>
                {t(`setting.${settingSection}`)}
              </Option>
            ))}
          </Select>
          {state.selectedSection === "my-account" ? (
            <MyAccountSection />
          ) : state.selectedSection === "preference" ? (
            <PreferencesSection />
          ) : state.selectedSection === "member" ? (
            <MemberSection />
          ) : state.selectedSection === "system" ? (
            <SystemSection />
          ) : state.selectedSection === "openai" ? (
            <OpenAISection />
          ) : state.selectedSection === "storage" ? (
            <StorageSection />
          ) : state.selectedSection === "sso" ? (
            <SSOSection />
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default Setting;
