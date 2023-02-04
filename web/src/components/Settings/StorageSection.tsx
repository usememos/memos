import { Checkbox, Tooltip } from "@mui/joy";
import { useTranslation } from "react-i18next";
import showEditSMMSConfigDialog from "../EditSMMSConfigDialog";
import "../../less/settings/storage-section.less";

const StorageSection = () => {
  const { t } = useTranslation();

  const handleSMMSClick = () => {
    showEditSMMSConfigDialog();
  };

  return (
    <div className="section-container storage-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <div className="form-label">
        <span className="normal-text"></span>
        <div className="w-16 flex justify-between">
          <Tooltip title="Images">
            <div>🖼️</div>
          </Tooltip>
          <Tooltip title="Other resources">
            <div>🗂️</div>
          </Tooltip>
        </div>
      </div>
      <div className="form-label">
        <span className="normal-text link-text" onClick={handleSMMSClick}>
          SM.MS
        </span>
        <div className="w-16 flex justify-between">
          <Checkbox />
          <Tooltip title="Not support">
            <Checkbox disabled />
          </Tooltip>
        </div>
      </div>
      <div className="form-label">
        <span className="normal-text">Database</span>
        <div className="w-16 flex justify-between">
          <Checkbox />
          <Checkbox />
        </div>
      </div>
    </div>
  );
};

export default StorageSection;
