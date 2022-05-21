import { useState } from "react";
import { useAppSelector } from "../store";
import { showDialog } from "./Dialog";
import MyAccountSection from "./Settings/MyAccountSection";
import PreferencesSection from "./Settings/PreferencesSection";
import MemberSection from "./Settings/MemberSection";
import "../less/setting-dialog.less";

interface Props extends DialogProps {}

type SettingSection = "my-account" | "preferences" | "member";

interface State {
  selectedSection: SettingSection;
}

const SettingDialog: React.FC<Props> = (props: Props) => {
  const {
    user: { user },
  } = useAppSelector((state) => state);
  const { destroy } = props;
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
        <img className="icon-img" src="/icons/close.svg" />
      </button>
      <div className="section-selector-container">
        <span className="section-title">Basic</span>
        <span
          onClick={() => handleSectionSelectorItemClick("my-account")}
          className={`section-item ${state.selectedSection === "my-account" ? "selected" : ""}`}
        >
          My account
        </span>
        <span
          onClick={() => handleSectionSelectorItemClick("preferences")}
          className={`section-item ${state.selectedSection === "preferences" ? "selected" : ""}`}
        >
          Preferences
        </span>
        {user?.role === "OWNER" ? (
          <>
            <span className="section-title">Admin</span>
            <span
              onClick={() => handleSectionSelectorItemClick("member")}
              className={`section-item ${state.selectedSection === "member" ? "selected" : ""}`}
            >
              Member
            </span>
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
        ) : null}
      </div>
    </div>
  );
};

export default function showSettingDialog(): void {
  showDialog(
    {
      className: "setting-dialog",
      useAppContext: true,
    },
    SettingDialog,
    {}
  );
}
