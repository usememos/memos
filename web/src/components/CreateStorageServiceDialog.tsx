import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Typography } from "@mui/joy";
import * as api from "../helpers/api";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import toastHelper from "./Toast";

interface Props extends DialogProps {
  storage?: Storage;
  confirmCallback?: () => void;
}

const CreateStorageServiceDialog: React.FC<Props> = (props: Props) => {
  const { destroy, storage, confirmCallback } = props;
  const { t } = useTranslation();
  const [storageCreate, setStorageCreate] = useState<StorageCreate>({
    name: "",
    endPoint: "",
    region: "",
    accessKey: "",
    secretKey: "",
    bucket: "",
    urlPrefix: "",
  });
  const isCreating = storage === undefined;

  useEffect(() => {
    if (storage) {
      setStorageCreate({ ...storage });
    }
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const allowConfirmAction = () => {
    if (
      storageCreate.name === "" ||
      storageCreate.endPoint === "" ||
      storageCreate.region === "" ||
      storageCreate.accessKey === "" ||
      storageCreate.bucket === "" ||
      storageCreate.bucket === ""
    ) {
      return false;
    }
    return true;
  };

  const handleConfirmBtnClick = async () => {
    try {
      if (isCreating) {
        await api.createStorage(storageCreate);
      } else {
        await api.patchStorage({
          id: storage.id,
          ...storageCreate,
        });
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
    if (confirmCallback) {
      confirmCallback();
    }
    destroy();
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.target.value;
    setStorageCreate({
      ...storageCreate,
      name,
    });
  };

  const handleEndPointChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const endPoint = event.target.value;
    setStorageCreate({
      ...storageCreate,
      endPoint,
    });
  };

  const handleRegionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const region = event.target.value;
    setStorageCreate({
      ...storageCreate,
      region,
    });
  };

  const handleAccessKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const accessKey = event.target.value;
    setStorageCreate({
      ...storageCreate,
      accessKey,
    });
  };

  const handleSecretKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const secretKey = event.target.value;
    setStorageCreate({
      ...storageCreate,
      secretKey,
    });
  };

  const handleBucketChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const bucket = event.target.value;
    setStorageCreate({
      ...storageCreate,
      bucket,
    });
  };

  const handleURLPrefixChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const urlPrefix = event.target.value;
    setStorageCreate({
      ...storageCreate,
      urlPrefix,
    });
  };

  return (
    <>
      <div className="dialog-header-container !w-64">
        <p className="title-text">
          {isCreating ? t("setting.storage-section.create-a-service") : t("setting.storage-section.update-a-service")}
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <Typography className="!mb-1" level="body2">
          Name
          <span className="text-sm text-gray-400 ml-1">(Unique identifier)</span>
        </Typography>
        <Input className="mb-2" placeholder="Name" value={storageCreate.name} onChange={handleNameChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          EndPoint
          <span className="text-sm text-gray-400 ml-1">(S3-compatible server URL)</span>
        </Typography>
        <Input className="mb-2" placeholder="EndPoint" value={storageCreate.endPoint} onChange={handleEndPointChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          Region
          <span className="text-sm text-gray-400 ml-1">(Region name)</span>
        </Typography>
        <Input className="mb-2" placeholder="Region" value={storageCreate.region} onChange={handleRegionChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          AccessKey
          <span className="text-sm text-gray-400 ml-1">(Access Key / Access ID)</span>
        </Typography>
        <Input className="mb-2" placeholder="AccessKey" value={storageCreate.accessKey} onChange={handleAccessKeyChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          SecretKey
          <span className="text-sm text-gray-400 ml-1">(Secret Key / Secret Access Key)</span>
        </Typography>
        <Input className="mb-2" placeholder="SecretKey" value={storageCreate.secretKey} onChange={handleSecretKeyChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          Bucket
          <span className="text-sm text-gray-400 ml-1">(Bucket name)</span>
        </Typography>
        <Input className="mb-2" placeholder="Bucket" value={storageCreate.bucket} onChange={handleBucketChange} fullWidth />
        <Typography className="!mb-1" level="body2">
          URLPrefix
          <span className="text-sm text-gray-400 ml-1">(Custom URL prefix; Optional)</span>
        </Typography>
        <Input className="mb-2" placeholder="URLPrefix" value={storageCreate.urlPrefix} onChange={handleURLPrefixChange} fullWidth />
        <div className="mt-2 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseBtnClick}>
            Cancel
          </Button>
          <Button onClick={handleConfirmBtnClick} disabled={!allowConfirmAction()}>
            {isCreating ? "Create" : "Update"}
          </Button>
        </div>
      </div>
    </>
  );
};

function showCreateStorageServiceDialog(storage?: Storage, confirmCallback?: () => void) {
  generateDialog(
    {
      className: "create-storage-service-dialog",
      dialogName: "create-storage-service-dialog",
    },
    CreateStorageServiceDialog,
    { storage, confirmCallback }
  );
}

export default showCreateStorageServiceDialog;
