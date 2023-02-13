import { Button, Input, Typography } from "@mui/joy";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import { showCommonDialog } from "./Dialog/CommonDialog";
import { useStorageStore } from "../store/module";
import toastHelper from "./Toast";

interface Props extends DialogProps {
  storage: StoragePatch;
}

const UpdateStorageServiceDialog: React.FC<Props> = (props: Props) => {
  const { storage, destroy } = props;
  const { t } = useTranslation();
  const storageStore = useStorageStore();
  const [storagePatch, setStoragePatch] = useState<StoragePatch>(storage);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const allowConfirmAction = () => {
    if (
      storagePatch.name === "" ||
      storagePatch.endPoint === "" ||
      storagePatch.region === "" ||
      storagePatch.accessKey === "" ||
      storagePatch.bucket === "" ||
      storagePatch.bucket === ""
    ) {
      return false;
    }
    return true;
  };

  const handleConfirmBtnClick = async () => {
    try {
      await storageStore.patchStorage(storagePatch);
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
    destroy();
  };

  const handleDeleteBtnClick = async () => {
    const warningText = t("setting.storage-section.warning-text");
    showCommonDialog({
      title: t("setting.storage-section.delete-storage"),
      content: warningText,
      style: "warning",
      dialogName: "delete-storage-dialog",
      onConfirm: async () => {
        try {
          await storageStore.deleteStorageById(storagePatch.id);
        } catch (error: any) {
          console.error(error);
          toastHelper.error(error.response.data.message);
        }
        destroy();
      },
    });
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value;
    setStoragePatch({
      ...storagePatch,
      name,
    });
  };

  const handleEndPointChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const endPoint = event.target.value;
    setStoragePatch({
      ...storagePatch,
      endPoint,
    });
  };

  const handleRegionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const region = event.target.value;
    setStoragePatch({
      ...storagePatch,
      region,
    });
  };

  const handleAccessKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const accessKey = event.target.value;
    setStoragePatch({
      ...storagePatch,
      accessKey,
    });
  };

  const handleSecretKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const secretKey = event.target.value;
    setStoragePatch({
      ...storagePatch,
      secretKey,
    });
  };

  const handleBucketChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const bucket = event.target.value;
    setStoragePatch({
      ...storagePatch,
      bucket,
    });
  };

  const handleURLPrefixChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const urlPrefix = event.target.value;
    setStoragePatch({
      ...storagePatch,
      urlPrefix,
    });
  };

  return (
    <>
      <div className="dialog-header-container !w-64">
        <p className="title-text">{t("setting.storage-section.update-a-service")}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <Typography className="!mb-1" level="body2">
          Name
        </Typography>
        <Input className="mb-2" placeholder="Name" value={storagePatch.name} onChange={handleNameChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          EndPoint
        </Typography>
        <Input className="mb-2" placeholder="EndPoint" value={storagePatch.endPoint} onChange={handleEndPointChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          Region
        </Typography>
        <Input className="mb-2" placeholder="Region" value={storagePatch.region} onChange={handleRegionChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          AccessKey
        </Typography>
        <Input className="mb-2" placeholder="AccessKey" value={storagePatch.accessKey} onChange={handleAccessKeyChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          SecretKey
        </Typography>
        <Input className="mb-2" placeholder="SecretKey" value={storagePatch.secretKey} onChange={handleSecretKeyChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          Bucket
        </Typography>
        <Input className="mb-2" placeholder="Bucket" value={storagePatch.bucket} onChange={handleBucketChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          URLPrefix
        </Typography>
        <Input className="mb-2" placeholder="URLPrefix" value={storagePatch.urlPrefix} onChange={handleURLPrefixChange} fullWidth />
        <div className="mt-2 w-full flex flex-row justify-between items-center space-x-1">
          <Button color="danger" onClick={handleDeleteBtnClick}>
            Delete
          </Button>
          <div className="flex justify-end">
            <Button variant="plain" color="neutral" onClick={handleCloseBtnClick}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBtnClick} disabled={!allowConfirmAction()}>
              Update
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

function showUpdateStorageServiceDialog(storage: Storage) {
  generateDialog(
    {
      className: "update-storage-service-dialog",
      dialogName: "update-storage-service-dialog",
    },
    UpdateStorageServiceDialog,
    { storage }
  );
}

export default showUpdateStorageServiceDialog;
