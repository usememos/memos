import { useEffect } from "react";
import { memoService } from "../services";
import { showDialog } from "./Dialog";
import MyAccountSection from "./MyAccountSection";
import PreferencesSection from "./PreferencesSection";
import "../less/setting-dialog.less";

interface Props extends DialogProps {}

const SettingDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;

  useEffect(() => {
    memoService.fetchAllMemos();
  }, []);

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">👤</span>
          Setting
        </p>
        <button className="btn close-btn" onClick={destroy}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        <MyAccountSection />
        <PreferencesSection />
      </div>
    </>
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
