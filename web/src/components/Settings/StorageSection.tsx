import { Divider, List, ListItem, Radio, RadioGroup, Tooltip, Switch } from "@mui/joy";
import { Button, Input } from "@usememos/mui";
import { isEqual } from "lodash-es";
import { HelpCircleIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { workspaceSettingNamePrefix } from "@/store/v1";
import { workspaceStore } from "@/store/v2";
import { WorkspaceSettingKey } from "@/store/v2/workspace";
import {
  WorkspaceStorageSetting,
  WorkspaceStorageSetting_S3Config,
  WorkspaceStorageSetting_StorageType,
} from "@/types/proto/api/v1/workspace_setting_service";
import { useTranslate } from "@/utils/i18n";

const StorageSection = () => {
  const t = useTranslate();
  const [workspaceStorageSetting, setWorkspaceStorageSetting] = useState<WorkspaceStorageSetting>(
    WorkspaceStorageSetting.fromPartial(workspaceStore.getWorkspaceSettingByKey(WorkspaceSettingKey.STORAGE)?.storageSetting || {}),
  );

  useEffect(() => {
    setWorkspaceStorageSetting(
      WorkspaceStorageSetting.fromPartial(workspaceStore.getWorkspaceSettingByKey(WorkspaceSettingKey.STORAGE)?.storageSetting || {}),
    );
  }, [workspaceStore.getWorkspaceSettingByKey(WorkspaceSettingKey.STORAGE)]);

  const allowSaveStorageSetting = useMemo(() => {
    if (workspaceStorageSetting.uploadSizeLimitMb <= 0) {
      return false;
    }

    const origin = WorkspaceStorageSetting.fromPartial(
      workspaceStore.getWorkspaceSettingByKey(WorkspaceSettingKey.STORAGE)?.storageSetting || {},
    );
    if (workspaceStorageSetting.storageType === WorkspaceStorageSetting_StorageType.LOCAL) {
      if (workspaceStorageSetting.filepathTemplate.length === 0) {
        return false;
      }
    } else if (workspaceStorageSetting.storageType === WorkspaceStorageSetting_StorageType.S3) {
      if (
        workspaceStorageSetting.s3Config?.accessKeyId.length === 0 ||
        workspaceStorageSetting.s3Config?.accessKeySecret.length === 0 ||
        workspaceStorageSetting.s3Config?.endpoint.length === 0 ||
        workspaceStorageSetting.s3Config?.region.length === 0 ||
        workspaceStorageSetting.s3Config?.bucket.length === 0
      ) {
        return false;
      }
    }
    return !isEqual(origin, workspaceStorageSetting);
  }, [workspaceStorageSetting, workspaceStore.state]);

  const handleMaxUploadSizeChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    let num = parseInt(event.target.value);
    if (Number.isNaN(num)) {
      num = 0;
    }
    const update: WorkspaceStorageSetting = {
      ...workspaceStorageSetting,
      uploadSizeLimitMb: num,
    };
    setWorkspaceStorageSetting(update);
  };

  const handleFilepathTemplateChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    const update: WorkspaceStorageSetting = {
      ...workspaceStorageSetting,
      filepathTemplate: event.target.value,
    };
    setWorkspaceStorageSetting(update);
  };

  const handlePartialS3ConfigChanged = async (s3Config: Partial<WorkspaceStorageSetting_S3Config>) => {
    const update: WorkspaceStorageSetting = {
      ...workspaceStorageSetting,
      s3Config: WorkspaceStorageSetting_S3Config.fromPartial({
        ...workspaceStorageSetting.s3Config,
        ...s3Config,
      }),
    };
    setWorkspaceStorageSetting(update);
  };

  const handleS3ConfigAccessKeyIdChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    handlePartialS3ConfigChanged({ accessKeyId: event.target.value });
  };

  const handleS3ConfigAccessKeySecretChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    handlePartialS3ConfigChanged({ accessKeySecret: event.target.value });
  };

  const handleS3ConfigEndpointChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    handlePartialS3ConfigChanged({ endpoint: event.target.value });
  };

  const handleS3ConfigRegionChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    handlePartialS3ConfigChanged({ region: event.target.value });
  };

  const handleS3ConfigBucketChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    handlePartialS3ConfigChanged({ bucket: event.target.value });
  };

  const handleS3ConfigUsePathStyleChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    handlePartialS3ConfigChanged({
      usePathStyle: event.target.checked,
    });
  };

  const handleStorageTypeChanged = async (storageType: WorkspaceStorageSetting_StorageType) => {
    const update: WorkspaceStorageSetting = {
      ...workspaceStorageSetting,
      storageType: storageType,
    };
    setWorkspaceStorageSetting(update);
  };

  const saveWorkspaceStorageSetting = async () => {
    await workspaceStore.upsertWorkspaceSetting({
      name: `${workspaceSettingNamePrefix}${WorkspaceSettingKey.STORAGE}`,
      storageSetting: workspaceStorageSetting,
    });
    toast.success("Updated");
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <div className="font-medium text-gray-700 dark:text-gray-500">{t("setting.storage-section.current-storage")}</div>
      <RadioGroup
        orientation="horizontal"
        className="w-full"
        value={workspaceStorageSetting.storageType}
        onChange={(event) => {
          handleStorageTypeChanged(event.target.value as WorkspaceStorageSetting_StorageType);
        }}
      >
        <Radio value={WorkspaceStorageSetting_StorageType.DATABASE} label={t("setting.storage-section.type-database")} />
        <Radio value={WorkspaceStorageSetting_StorageType.LOCAL} label={t("setting.storage-section.type-local")} />
        <Radio value={WorkspaceStorageSetting_StorageType.S3} label={"S3"} />
      </RadioGroup>
      <div className="w-full flex flex-row justify-between items-center">
        <div className="flex flex-row items-center">
          <span className="text-gray-700 dark:text-gray-500 mr-1">{t("setting.system-section.max-upload-size")}</span>
          <Tooltip title={t("setting.system-section.max-upload-size-hint")} placement="top">
            <HelpCircleIcon className="w-4 h-auto" />
          </Tooltip>
        </div>
        <Input className="w-16 font-mono" value={workspaceStorageSetting.uploadSizeLimitMb} onChange={handleMaxUploadSizeChanged} />
      </div>
      {workspaceStorageSetting.storageType !== WorkspaceStorageSetting_StorageType.DATABASE && (
        <div className="w-full flex flex-row justify-between items-center">
          <span className="text-gray-700 dark:text-gray-500 mr-1">{t("setting.storage-section.filepath-template")}</span>
          <Input
            value={workspaceStorageSetting.filepathTemplate}
            placeholder="assets/{timestamp}_{filename}"
            onChange={handleFilepathTemplateChanged}
          />
        </div>
      )}
      {workspaceStorageSetting.storageType === WorkspaceStorageSetting_StorageType.S3 && (
        <>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-gray-700 dark:text-gray-500 mr-1">Access key id</span>
            <Input value={workspaceStorageSetting.s3Config?.accessKeyId} placeholder="" onChange={handleS3ConfigAccessKeyIdChanged} />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-gray-700 dark:text-gray-500 mr-1">Access key secret</span>
            <Input
              value={workspaceStorageSetting.s3Config?.accessKeySecret}
              placeholder=""
              onChange={handleS3ConfigAccessKeySecretChanged}
            />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-gray-700 dark:text-gray-500 mr-1">Endpoint</span>
            <Input value={workspaceStorageSetting.s3Config?.endpoint} placeholder="" onChange={handleS3ConfigEndpointChanged} />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-gray-700 dark:text-gray-500 mr-1">Region</span>
            <Input value={workspaceStorageSetting.s3Config?.region} placeholder="" onChange={handleS3ConfigRegionChanged} />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-gray-700 dark:text-gray-500 mr-1">Bucket</span>
            <Input value={workspaceStorageSetting.s3Config?.bucket} placeholder="" onChange={handleS3ConfigBucketChanged} />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-gray-700 dark:text-gray-500 mr-1">Use Path Style</span>
            <Switch checked={workspaceStorageSetting.s3Config?.usePathStyle} onChange={handleS3ConfigUsePathStyleChanged} />
          </div>
        </>
      )}
      <div>
        <Button color="primary" disabled={!allowSaveStorageSetting} onClick={saveWorkspaceStorageSetting}>
          {t("common.save")}
        </Button>
      </div>
      <Divider className="!my-2" />
      <div className="w-full mt-4">
        <p className="text-sm">{t("common.learn-more")}:</p>
        <List component="ul" marker="disc" size="sm">
          <ListItem>
            <Link
              className="text-sm text-blue-600 hover:underline"
              to="https://www.usememos.com/docs/advanced-settings/local-storage"
              target="_blank"
            >
              Docs - Local storage
            </Link>
          </ListItem>
          <ListItem>
            <Link
              className="text-sm text-blue-600 hover:underline"
              to="https://www.usememos.com/blog/choosing-a-storage-for-your-resource"
              target="_blank"
            >
              Choosing a Storage for Your Resource: Database, S3 or Local Storage?
            </Link>
          </ListItem>
        </List>
      </div>
    </div>
  );
};

export default StorageSection;
