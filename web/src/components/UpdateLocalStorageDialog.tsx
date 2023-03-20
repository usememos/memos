import { useState } from "react";
import { Button, Input, Typography } from "@mui/joy";
import { toast } from "react-hot-toast";
import * as api from "../helpers/api";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import { useGlobalStore } from "../store/module";

interface Props extends DialogProps {
  localStoragePath?: string;
  confirmCallback?: () => void;
}

const UpdateLocalStorageDialog: React.FC<Props> = (props: Props) => {
  const { destroy, localStoragePath, confirmCallback } = props;
  const globalStore = useGlobalStore();
  const [path, setPath] = useState(localStoragePath || "");

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleConfirmBtnClick = async () => {
    try {
      await api.upsertSystemSetting({
        name: "localStoragePath",
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
        <p className="title-text">Update local storage path</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="py-2">
          <Typography className="!mb-1" level="body2">
            Local Path
          </Typography>
          <Typography className="!mb-1" level="body2">
            <span className="text-sm text-gray-400 ml-1">{"e.g., {year}/{month}/{day}/your/path/{timestamp}_{filename}"}</span>
          </Typography>
          <Input className="mb-2" placeholder="Path" value={path} onChange={(e) => setPath(e.target.value)} fullWidth />
        </div>
        <div className="mt-2 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseBtnClick}>
            Cancel
          </Button>
          <Button onClick={handleConfirmBtnClick}>Update</Button>
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
