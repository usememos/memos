import { Button, Input, Typography } from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import * as api from "@/helpers/api";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import LearnMore from "./LearnMore";
import RequiredBadge from "./RequiredBadge";

interface Props extends DialogProps {
  storage?: ObjectStorage;
  confirmCallback?: () => void;
}

const CreateStorageServiceDialog: React.FC<Props> = (props: Props) => {
  const t = useTranslate();
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
        <span className="title-text ml-auto">
          {t(isCreating ? "setting.storage-section.create-storage" : "setting.storage-section.update-storage")}
        </span>
        <button className="btn close-btn ml-auto" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container min-w-[19rem]">
        <Typography className="!mb-1" level="body-md">
          {t("common.name")}
          <RequiredBadge />
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("common.name")}
          value={basicInfo.name}
          onChange={(e) =>
            setBasicInfo({
              ...basicInfo,
              name: e.target.value,
            })
          }
          fullWidth
        />
        <Typography className="!mb-1" level="body-md">
          {t("setting.storage-section.endpoint")}
          <RequiredBadge />
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.s3-compatible-url")}
          value={s3Config.endPoint}
          onChange={(e) => setPartialS3Config({ endPoint: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body-md">
          {t("setting.storage-section.region")}
          <RequiredBadge />
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.region-placeholder")}
          value={s3Config.region}
          onChange={(e) => setPartialS3Config({ region: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body-md">
          {t("setting.storage-section.accesskey")}
          <RequiredBadge />
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.accesskey-placeholder")}
          value={s3Config.accessKey}
          onChange={(e) => setPartialS3Config({ accessKey: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body-md">
          {t("setting.storage-section.secretkey")}
          <RequiredBadge />
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.secretkey-placeholder")}
          value={s3Config.secretKey}
          onChange={(e) => setPartialS3Config({ secretKey: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body-md">
          {t("setting.storage-section.bucket")}
          <RequiredBadge />
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.bucket-placeholder")}
          value={s3Config.bucket}
          onChange={(e) => setPartialS3Config({ bucket: e.target.value })}
          fullWidth
        />
        <div className="flex flex-row items-center mb-1">
          <Typography level="body-md">{t("setting.storage-section.path")}</Typography>
          <LearnMore className="ml-1" title={t("setting.storage-section.path-description")} url="https://usememos.com/docs/local-storage" />
        </div>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.path-placeholder") + "/{year}/{month}/{filename}"}
          value={s3Config.path}
          onChange={(e) => setPartialS3Config({ path: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body-md">
          {t("setting.storage-section.url-prefix")}
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.url-prefix-placeholder")}
          value={s3Config.urlPrefix}
          onChange={(e) => setPartialS3Config({ urlPrefix: e.target.value })}
          fullWidth
        />
        <Typography className="!mb-1" level="body-md">
          {t("setting.storage-section.url-suffix")}
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("setting.storage-section.url-suffix-placeholder")}
          value={s3Config.urlSuffix}
          onChange={(e) => setPartialS3Config({ urlSuffix: e.target.value })}
          fullWidth
        />
        <div className="mt-2 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirmBtnClick} disabled={!allowConfirmAction()}>
            {t(isCreating ? "common.create" : "common.update")}
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
