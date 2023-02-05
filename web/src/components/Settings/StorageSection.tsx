import { Checkbox, Tooltip } from "@mui/joy";
import { useTranslation } from "react-i18next";
import { useUserStore } from "../../store/module";
import showEditSMMSConfigDialog from "../EditSMMSConfigDialog";
import "../../less/settings/storage-section.less";

const StorageSection = () => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const { setting } = userStore.state.user as User;

  const handleSMMSClick = () => {
    showEditSMMSConfigDialog();
  };

  const handleImageStorageLocationChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await userStore.upsertUserSetting("storageConfig", {
      ...setting.storageConfig,
      imageStorage: e.target.value as string,
    });
  };

  const handleOthersStorageLocationChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await userStore.upsertUserSetting("storageConfig", {
      ...setting.storageConfig,
      othersStorage: e.target.value as string,
    });
  };

  return (
    <div className="section-container storage-section-container">
      <p className="title-text">{t("common.basic")}</p>
      <div className="form-label">
        <span className="normal-text"></span>
        <div className="w-16 flex justify-between">
          <Tooltip title={t("common.image")}>
            <div>🖼️</div>
          </Tooltip>
          <Tooltip title={t("common.other-resources")}>
            <div>🗂️</div>
          </Tooltip>
        </div>
      </div>
      <div className="form-label">
        <span className="normal-text link-text" onClick={handleSMMSClick}>
          SM.MS
        </span>
        <div className="w-16 flex justify-between">
          <Checkbox checked={setting.storageConfig?.imageStorage === "SMMS"} value="SMMS" onChange={handleImageStorageLocationChanged} />
          <Tooltip title={t("common.no-support")}>
            <Checkbox disabled />
          </Tooltip>
        </div>
      </div>
      <div className="form-label">
        <span className="normal-text">Database</span>
        <div className="w-16 flex justify-between">
          <Checkbox
            checked={!setting.storageConfig?.imageStorage || setting.storageConfig?.imageStorage === "Database"}
            value="Database"
            onChange={handleImageStorageLocationChanged}
          />
          <Checkbox
            checked={!setting.storageConfig?.imageStorage || setting.storageConfig?.othersStorage === "Database"}
            value="Database"
            onChange={handleOthersStorageLocationChanged}
          />
        </div>
      </div>
    </div>
  );
};

export default StorageSection;
