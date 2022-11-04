import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import MyAccountSection from "./Settings/MyAccountSection";
import PreferencesSection from "./Settings/PreferencesSection";
import MemberSection from "./Settings/MemberSection";
import SystemSection from "./Settings/SystemSection";
import "../less/setting-dialog.less";

type Props = DialogProps;

type SettingSection = "my-account" | "preferences" | "member" | "system";

interface State {
  selectedSection: SettingSection;
}

const SettingDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.user.user);
  const [state, setState] = useState<State>({
    selectedSection: "my-account",
  });

  const handleSectionSelectorItemClick = (settingSection: SettingSection) => {
    setState({
      selectedSection: settingSection,
    });
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
            <span className="icon-text">🤠</span> {t("setting.my-account")}
          </span>
          <span
            onClick={() => handleSectionSelectorItemClick("preferences")}
            className={`section-item ${state.selectedSection === "preferences" ? "selected" : ""}`}
          >
            <span className="icon-text">🏟</span> {t("setting.preference")}
          </span>
        </div>
        {user?.role === "HOST" ? (
          <>
            <span className="section-title">{t("common.admin")}</span>
            <div className="section-items-container">
              <span
                onClick={() => handleSectionSelectorItemClick("member")}
                className={`section-item ${state.selectedSection === "member" ? "selected" : ""}`}
              >
                <span className="icon-text">👤</span> {t("setting.member")}
              </span>
              <span
                onClick={() => handleSectionSelectorItemClick("system")}
                className={`section-item ${state.selectedSection === "system" ? "selected" : ""}`}
              >
                <span className="icon-text">🧑‍🔧</span> System
              </span>
            </div>
          </>
        ) : null}
      </div>
      <div className="section-content-container">
        {state.selectedSection === "my-account" ? (
          <MyAccountSection />
        ) : state.selectedSection === "preferences" ? (
          <PreferencesSection />
        ) : state.selectedSection === "member" ? (
          <MemberSection />
        ) : state.selectedSection === "system" ? (
          <SystemSection />
        ) : null}
      </div>
    </div>
  );
};

export default function showSettingDialog(): void {
  generateDialog(
    {
      className: "setting-dialog",
    },
    SettingDialog,
    {}
  );
}
