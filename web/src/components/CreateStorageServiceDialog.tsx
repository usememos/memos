import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button, Input, Typography } from "@mui/joy";
import * as api from "../helpers/api";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import RequiredBadge from "./RequiredBadge";

interface Props extends DialogProps {
  storage?: ObjectStorage;
  confirmCallback?: () => void;
}

const CreateStorageServiceDialog: React.FC<Props> = (props: Props) => {
  const { destroy, storage, confirmCallback } = props;
  const [basicInfo, setBasicInfo] = useState({
    name: "",
  });
  const [type, setType] = useState<StorageType>("S3");
  const [s3Config, setS3Config] = useState<StorageS3Config>({
    endPoint: "",
    region: "",
    accessKey: "",
    secretKey: "",
    path: "",
    bucket: "",
    urlPrefix: "",
    urlSuffix: "",
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
      if (
        s3Config.endPoint === "" ||
        s3Config.region === "" ||
        s3Config.accessKey === "" ||
        s3Config.secretKey === "" ||
        s3Config.bucket === ""
      ) {
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
      toast.error(error.response.data.message);
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
      <div className="dialog-header-container">
        <p className="title-text">
          {isCreating ? "Create storage" : "Update storage"}
          <a
            className="ml-2 text-sm text-blue-600 hover:opacity-80 hover:underline"
            href="https://usememos.com/docs/storage"
            target="_blank"
          >
            Learn more
            <Icon.ExternalLink className="inline -mt-1 ml-1 w-4 h-auto opacity-80" />
          </a>
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <Typography className="!mb-1" level="body2">
          Name
          <RequiredBadge />
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
          <RequiredBadge />
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
          <RequiredBadge />
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
          <RequiredBadge />
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
          <RequiredBadge />
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
          <RequiredBadge />
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
          Path
          <span className="text-sm text-gray-400 ml-1">(Storage Path)</span>
        </Typography>
        <Typography className="!mb-1" level="body2">
          <p className="text-sm text-gray-400 ml-1">{"You can use {year}, {month}, {day}, {hour}, {minute}, {second},"}</p>
          <p className="text-sm text-gray-400 ml-1">{"{filename}, {timestamp} and any other words."}</p>
          <p className="text-sm text-gray-400 ml-1">{"e.g., {year}/{month}/{day}/your/path/{filename}"}</p>
        </Typography>
        <Input
          className="mb-2"
          placeholder="Path"
          value={s3Config.path}
          onChange={(e) => setPartialS3Config({ path: e.target.value })}
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
        <Typography className="!mb-1" level="body2">
          URLSuffix
          <span className="text-sm text-gray-400 ml-1">(Custom URL suffix; Optional)</span>
        </Typography>
        <Input
          className="mb-2"
          placeholder="URLSuffix"
          value={s3Config.urlSuffix}
          onChange={(e) => setPartialS3Config({ urlSuffix: e.target.value })}
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
