import { useEffect } from "react";
import { memoService } from "../services";
import MyAccountSection from "../components/MyAccountSection";
import PreferencesSection from "../components/PreferencesSection";
import "../less/setting.less";

interface Props {}

const Setting: React.FC<Props> = () => {
  useEffect(() => {
    memoService.fetchAllMemos();
  }, []);

  return (
    <div className="preference-wrapper">
      <div className="section-header-container">
        <div className="title-text">
          <span className="normal-text">Settings</span>
        </div>
      </div>

      <div className="sections-wrapper">
        <MyAccountSection />
        <PreferencesSection />
      </div>
    </div>
  );
};

export default Setting;
