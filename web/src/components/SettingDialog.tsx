import { Option, Select } from "@mui/joy";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserStore } from "../store/module";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import BetaBadge from "./BetaBadge";
import MyAccountSection from "./Settings/MyAccountSection";
import PreferencesSection from "./Settings/PreferencesSection";
import MemberSection from "./Settings/MemberSection";
import SystemSection from "./Settings/SystemSection";
import StorageSection from "./Settings/StorageSection";
import SSOSection from "./Settings/SSOSection";
import "../less/setting-dialog.less";

type Props = DialogProps;

type SettingSection = "my-account" | "preference" | "member" | "system" | "storage" | "sso";

interface State {
  selectedSection: SettingSection;
}

const SettingDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const { t } = useTranslation();
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
      settingList = settingList.concat(["member", "system", "storage", "sso"]);
    }
    return settingList;
  };

  return (
    <div className="dialog-content-container">
      <button className="btn close-btn" onClick={destroy}>
        <Icon.X className="icon-img" />
      </button>
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
          className="block sm:!hidden"
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
        ) : state.selectedSection === "storage" ? (
          <StorageSection />
        ) : state.selectedSection === "sso" ? (
          <SSOSection />
        ) : null}
      </div>
    </div>
  );
};

export default function showSettingDialog(): void {
  generateDialog(
    {
      className: "setting-dialog",
      dialogName: "setting-dialog",
    },
    SettingDialog,
    {}
  );
}
