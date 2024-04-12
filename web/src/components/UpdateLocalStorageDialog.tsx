import { Button, IconButton, Input } from "@mui/joy";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { WorkspaceSettingPrefix, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceSettingKey, WorkspaceStorageSetting } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import LearnMore from "./LearnMore";

interface Props extends DialogProps {
  confirmCallback?: () => void;
}

const UpdateLocalStorageDialog: React.FC<Props> = (props: Props) => {
  const t = useTranslate();
  const { destroy, confirmCallback } = props;
  const workspaceSettingStore = useWorkspaceSettingStore();
  const [workspaceStorageSetting, setWorkspaceStorageSetting] = useState<WorkspaceStorageSetting>(
    WorkspaceStorageSetting.fromPartial(
      workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.WORKSPACE_SETTING_STORAGE)?.storageSetting || {},
    ),
  );

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleConfirmBtnClick = async () => {
    try {
      await workspaceSettingStore.setWorkspaceSetting({
        name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.WORKSPACE_SETTING_STORAGE}`,
        storageSetting: workspaceStorageSetting,
      });
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
    if (confirmCallback) {
      confirmCallback();
    }
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("setting.storage-section.update-local-path")}</p>
        <IconButton size="sm" onClick={handleCloseBtnClick}>
          <Icon.X className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="dialog-content-container max-w-xs">
        <p className="text-sm break-words mb-1">{t("setting.storage-section.update-local-path-description")}</p>
        <div className="flex flex-row items-center mb-2 gap-x-2">
          <span className="text-sm text-gray-400 break-all">e.g. {"assets/{timestamp}_{filename}"}</span>
          <LearnMore url="https://usememos.com/docs/advanced-settings/local-storage" />
        </div>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.local-storage-path")}
          fullWidth
          value={workspaceStorageSetting.localStoragePath}
          onChange={(e) => setWorkspaceStorageSetting({ ...workspaceStorageSetting, localStoragePath: e.target.value })}
        />
        <div className="mt-2 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirmBtnClick}>{t("common.update")}</Button>
        </div>
      </div>
    </>
  );
};

function showUpdateLocalStorageDialog(confirmCallback?: () => void) {
  generateDialog(
    {
      className: "update-local-storage-dialog",
      dialogName: "update-local-storage-dialog",
    },
    UpdateLocalStorageDialog,
    { confirmCallback },
  );
}

export default showUpdateLocalStorageDialog;
