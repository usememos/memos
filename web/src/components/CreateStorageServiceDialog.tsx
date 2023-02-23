import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Typography } from "@mui/joy";
import * as api from "../helpers/api";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import toastHelper from "./Toast";

interface Props extends DialogProps {
  storage?: ObjectStorage;
  confirmCallback?: () => void;
}

const CreateStorageServiceDialog: React.FC<Props> = (props: Props) => {
  const { destroy, storage, confirmCallback } = props;
  const { t } = useTranslation();
  const [basicInfo, setBasicInfo] = useState({
    name: "",
  });
  const [type, setType] = useState<StorageType>("S3");
  const [s3Config, setS3Config] = useState<StorageS3Config>({
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
      setBasicInfo({
        name: storage.name,
      });
      setType(storage.type);
      if (storage.type === "S3") {
        setS3Config(storage.config.s3Config);
      }
    }
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const allowConfirmAction = () => {
    if (basicInfo.name === "") {
      return false;
    }
    if (type === "S3") {
      if (s3Config.endPoint === "" || s3Config.region === "" || s3Config.accessKey === "" || s3Config.bucket === "") {
        return false;
      }
    }
    return true;
  };

  const handleConfirmBtnClick = async () => {
    try {
      if (isCreating) {
        await api.createStorage({
          ...basicInfo,
          type: type,
          config: {
            s3Config: s3Config,
          },
        });
      } else {
        await api.patchStorage({
          id: storage.id,
          type: type,
          ...basicInfo,
          config: {
            s3Config: s3Config,
          },
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

  const setPartialS3Config = (state: Partial<StorageS3Config>) => {
    setS3Config({
      ...s3Config,
      ...state,
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
        <Input
          className="mb-2"
          placeholder="Name"
          value={basicInfo.name}
          onChange={(e) =>
            setBasicInfo({
              ...basicInfo,
              name: e.target.value,
            })
          }
          fullWidth
        />
        <Typography className="!mb-1" level="body2">
          EndPoint
          <span className="text-sm text-gray-400 ml-1">(S3-compatible server URL)</span>
        </Typography>
        <Input
          className="mb-2"
          placeholder="EndPoint"
          value={s3Config.endPoint}
          onChange={(e) => setPartialS3Config({ endPoint: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body2">
          Region
          <span className="text-sm text-gray-400 ml-1">(Region name)</span>
        </Typography>
        <Input
          className="mb-2"
          placeholder="Region"
          value={s3Config.region}
          onChange={(e) => setPartialS3Config({ region: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body2">
          AccessKey
          <span className="text-sm text-gray-400 ml-1">(Access Key / Access ID)</span>
        </Typography>
        <Input
          className="mb-2"
          placeholder="AccessKey"
          value={s3Config.accessKey}
          onChange={(e) => setPartialS3Config({ accessKey: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body2">
          SecretKey
          <span className="text-sm text-gray-400 ml-1">(Secret Key / Secret Access Key)</span>
        </Typography>
        <Input
          className="mb-2"
          placeholder="SecretKey"
          value={s3Config.secretKey}
          onChange={(e) => setPartialS3Config({ secretKey: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body2">
          Bucket
          <span className="text-sm text-gray-400 ml-1">(Bucket name)</span>
        </Typography>
        <Input
          className="mb-2"
          placeholder="Bucket"
          value={s3Config.bucket}
          onChange={(e) => setPartialS3Config({ bucket: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body2">
          URLPrefix
          <span className="text-sm text-gray-400 ml-1">(Custom URL prefix; Optional)</span>
        </Typography>
        <Input
          className="mb-2"
          placeholder="URLPrefix"
          value={s3Config.urlPrefix}
          onChange={(e) => setPartialS3Config({ urlPrefix: e.target.value })}
          fullWidth
        />
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

function showCreateStorageServiceDialog(storage?: ObjectStorage, confirmCallback?: () => void) {
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
