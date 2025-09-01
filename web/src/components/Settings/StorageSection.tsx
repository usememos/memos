import { isEqual } from "lodash-es";
import { HelpCircleIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { workspaceStore } from "@/store";
import { workspaceSettingNamePrefix } from "@/store/common";
import {
  WorkspaceSetting_Key,
  WorkspaceSetting_StorageSetting,
  WorkspaceSetting_StorageSetting_S3Config,
  WorkspaceSetting_StorageSetting_StorageType,
} from "@/types/proto/api/v1/workspace_service";
import { useTranslate } from "@/utils/i18n";

const StorageSection = observer(() => {
  const t = useTranslate();
  const [workspaceStorageSetting, setWorkspaceStorageSetting] = useState<WorkspaceSetting_StorageSetting>(
    WorkspaceSetting_StorageSetting.fromPartial(
      workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.STORAGE)?.storageSetting || {},
    ),
  );

  useEffect(() => {
    setWorkspaceStorageSetting(
      WorkspaceSetting_StorageSetting.fromPartial(
        workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.STORAGE)?.storageSetting || {},
      ),
    );
  }, [workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.STORAGE)]);

  const allowSaveStorageSetting = useMemo(() => {
    if (workspaceStorageSetting.uploadSizeLimitMb <= 0) {
      return false;
    }

    const origin = WorkspaceSetting_StorageSetting.fromPartial(
      workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.STORAGE)?.storageSetting || {},
    );
    if (workspaceStorageSetting.storageType === WorkspaceSetting_StorageSetting_StorageType.LOCAL) {
      if (workspaceStorageSetting.filepathTemplate.length === 0) {
        return false;
      }
    } else if (workspaceStorageSetting.storageType === WorkspaceSetting_StorageSetting_StorageType.S3) {
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
    const update: WorkspaceSetting_StorageSetting = {
      ...workspaceStorageSetting,
      uploadSizeLimitMb: num,
    };
    setWorkspaceStorageSetting(update);
  };

  const handleFilepathTemplateChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    const update: WorkspaceSetting_StorageSetting = {
      ...workspaceStorageSetting,
      filepathTemplate: event.target.value,
    };
    setWorkspaceStorageSetting(update);
  };

  const handlePartialS3ConfigChanged = async (s3Config: Partial<WorkspaceSetting_StorageSetting_S3Config>) => {
    const update: WorkspaceSetting_StorageSetting = {
      ...workspaceStorageSetting,
      s3Config: WorkspaceSetting_StorageSetting_S3Config.fromPartial({
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

  const handleStorageTypeChanged = async (storageType: WorkspaceSetting_StorageSetting_StorageType) => {
    const update: WorkspaceSetting_StorageSetting = {
      ...workspaceStorageSetting,
      storageType: storageType,
    };
    setWorkspaceStorageSetting(update);
  };

  const saveWorkspaceStorageSetting = async () => {
    await workspaceStore.upsertWorkspaceSetting({
      name: `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.STORAGE}`,
      storageSetting: workspaceStorageSetting,
    });
    toast.success("Updated");
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <div className="font-medium text-muted-foreground">{t("setting.storage-section.current-storage")}</div>
      <RadioGroup
        value={workspaceStorageSetting.storageType}
        onValueChange={(value) => {
          handleStorageTypeChanged(value as WorkspaceSetting_StorageSetting_StorageType);
        }}
        className="flex flex-row gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value={WorkspaceSetting_StorageSetting_StorageType.DATABASE} id="database" />
          <Label htmlFor="database">{t("setting.storage-section.type-database")}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value={WorkspaceSetting_StorageSetting_StorageType.LOCAL} id="local" />
          <Label htmlFor="local">{t("setting.storage-section.type-local")}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value={WorkspaceSetting_StorageSetting_StorageType.S3} id="s3" />
          <Label htmlFor="s3">S3</Label>
        </div>
      </RadioGroup>
      <div className="w-full flex flex-row justify-between items-center">
        <div className="flex flex-row items-center">
          <span className="text-muted-foreground mr-1">{t("setting.system-section.max-upload-size")}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircleIcon className="w-4 h-auto" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("setting.system-section.max-upload-size-hint")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input className="w-16 font-mono" value={workspaceStorageSetting.uploadSizeLimitMb} onChange={handleMaxUploadSizeChanged} />
      </div>
      {workspaceStorageSetting.storageType !== WorkspaceSetting_StorageSetting_StorageType.DATABASE && (
        <div className="w-full flex flex-row justify-between items-center">
          <span className="text-muted-foreground mr-1">{t("setting.storage-section.filepath-template")}</span>
          <Input
            className="w-64"
            value={workspaceStorageSetting.filepathTemplate}
            placeholder="assets/{timestamp}_{filename}"
            onChange={handleFilepathTemplateChanged}
          />
        </div>
      )}
      {workspaceStorageSetting.storageType === WorkspaceSetting_StorageSetting_StorageType.S3 && (
        <>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Access key id</span>
            <Input
              className="w-64"
              value={workspaceStorageSetting.s3Config?.accessKeyId}
              placeholder=""
              onChange={handleS3ConfigAccessKeyIdChanged}
            />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Access key secret</span>
            <Input
              className="w-64"
              value={workspaceStorageSetting.s3Config?.accessKeySecret}
              placeholder=""
              onChange={handleS3ConfigAccessKeySecretChanged}
            />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Endpoint</span>
            <Input
              className="w-64"
              value={workspaceStorageSetting.s3Config?.endpoint}
              placeholder=""
              onChange={handleS3ConfigEndpointChanged}
            />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Region</span>
            <Input
              className="w-64"
              value={workspaceStorageSetting.s3Config?.region}
              placeholder=""
              onChange={handleS3ConfigRegionChanged}
            />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Bucket</span>
            <Input
              className="w-64"
              value={workspaceStorageSetting.s3Config?.bucket}
              placeholder=""
              onChange={handleS3ConfigBucketChanged}
            />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Use Path Style</span>
            <Switch
              checked={workspaceStorageSetting.s3Config?.usePathStyle}
              onCheckedChange={(checked) => handleS3ConfigUsePathStyleChanged({ target: { checked } } as any)}
            />
          </div>
        </>
      )}
      <div>
        <Button disabled={!allowSaveStorageSetting} onClick={saveWorkspaceStorageSetting}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
});

export default StorageSection;
