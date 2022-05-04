import { useState } from "react";
import { showDialog } from "./Dialog";
import MyAccountSection from "./MyAccountSection";
import PreferencesSection from "./PreferencesSection";
import "../less/setting-dialog.less";

interface Props extends DialogProps {}

type SettingSection = "my-account" | "preferences";

interface State {
  selectedSection: SettingSection;
}

const SettingDialog: React.FC<Props> = (props: Props) => {
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
      </div>
      <div className="section-content-container">
        {state.selectedSection === "my-account" ? (
          <MyAccountSection />
        ) : state.selectedSection === "preferences" ? (
          <PreferencesSection />
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
