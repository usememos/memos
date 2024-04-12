import { Button, IconButton, Input, Checkbox, Typography } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { storageServiceClient } from "@/grpcweb";
import { S3Config, Storage, Storage_Type } from "@/types/proto/api/v2/storage_service";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import LearnMore from "./LearnMore";
import RequiredBadge from "./RequiredBadge";

interface Props extends DialogProps {
  storage?: Storage;
  confirmCallback?: () => void;
}

const CreateStorageServiceDialog: React.FC<Props> = (props: Props) => {
  const t = useTranslate();
  const { destroy, storage, confirmCallback } = props;
  const [basicInfo, setBasicInfo] = useState({
    title: "",
  });
  const [type] = useState<Storage_Type>(Storage_Type.S3);
  const [s3Config, setS3Config] = useState<S3Config>({
    endPoint: "",
    region: "",
    accessKey: "",
    secretKey: "",
    path: "",
    bucket: "",
    urlPrefix: "",
    urlSuffix: "",
    preSign: false,
  });
  const isCreating = storage === undefined;

  useEffect(() => {
    if (storage) {
      setBasicInfo({
        title: storage.title,
      });
      if (storage.type === "S3") {
        setS3Config(S3Config.fromPartial(storage.config?.s3Config || {}));
      }
    }
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const allowConfirmAction = () => {
    if (basicInfo.title === "") {
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
        await storageServiceClient.createStorage({
          storage: Storage.fromPartial({
            title: basicInfo.title,
            type: type,
            config: {
              s3Config: s3Config,
            },
          }),
        });
      } else {
        await storageServiceClient.updateStorage({
          storage: Storage.fromPartial({
            title: basicInfo.title,
            type: type,
            config: {
              s3Config: s3Config,
            },
          }),
          updateMask: ["title", "config"],
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

  const setPartialS3Config = (state: Partial<S3Config>) => {
    setS3Config({
      ...s3Config,
      ...state,
    });
  };

  return (
    <>
      <div className="dialog-header-container">
        <span>{t(isCreating ? "setting.storage-section.create-storage" : "setting.storage-section.update-storage")}</span>
        <IconButton size="sm" onClick={handleCloseBtnClick}>
          <Icon.X className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="dialog-content-container min-w-[19rem]">
        <Typography className="!mb-1" level="body-md">
          {t("common.name")}
          <RequiredBadge />
        </Typography>
        <Input
          className="mb-2"
          placeholder={t("common.name")}
          value={basicInfo.title}
          onChange={(e) =>
            setBasicInfo({
              ...basicInfo,
              title: e.target.value,
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
          <LearnMore
            className="ml-1"
            title={t("setting.storage-section.path-description")}
            url="https://usememos.com/docs/advanced-settings/local-storage"
          />
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
        <Checkbox
          className="mb-2"
          label={t("setting.storage-section.presign-placeholder")}
          checked={s3Config.preSign}
          onChange={(e) => setPartialS3Config({ preSign: e.target.checked })}
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

function showCreateStorageServiceDialog(storage?: Storage, confirmCallback?: () => void) {
  generateDialog(
    {
      className: "create-storage-service-dialog",
      dialogName: "create-storage-service-dialog",
    },
    CreateStorageServiceDialog,
    { storage, confirmCallback },
  );
}

export default showCreateStorageServiceDialog;
