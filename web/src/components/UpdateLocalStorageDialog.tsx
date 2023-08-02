import { Button, Input } from "@mui/joy";
import { useState } from "react";
import { toast } from "react-hot-toast";
import * as api from "@/helpers/api";
import { useGlobalStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import LearnMore from "./LearnMore";

interface Props extends DialogProps {
  localStoragePath?: string;
  confirmCallback?: () => void;
}

const UpdateLocalStorageDialog: React.FC<Props> = (props: Props) => {
  const t = useTranslate();
  const { destroy, localStoragePath, confirmCallback } = props;
  const globalStore = useGlobalStore();
  const [path, setPath] = useState(localStoragePath || "");

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleConfirmBtnClick = async () => {
    try {
      await api.upsertSystemSetting({
        name: "local-storage-path",
        value: JSON.stringify(path),
      });
      await globalStore.fetchSystemStatus();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
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
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container max-w-xs">
        <p className="text-sm break-words mb-1">{t("setting.storage-section.update-local-path-description")}</p>
        <div className="flex flex-row">
          <p className="text-sm text-gray-400 mb-2 break-all">e.g. {"assets/{filename}"}</p>
          <LearnMore url="https://usememos.com/docs/local-storage" />
        </div>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.local-storage-path")}
          fullWidth
          value={path}
          onChange={(e) => setPath(e.target.value)}
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

function showUpdateLocalStorageDialog(localStoragePath?: string, confirmCallback?: () => void) {
  generateDialog(
    {
      className: "update-local-storage-dialog",
      dialogName: "update-local-storage-dialog",
    },
    UpdateLocalStorageDialog,
    { localStoragePath, confirmCallback }
  );
}

export default showUpdateLocalStorageDialog;
