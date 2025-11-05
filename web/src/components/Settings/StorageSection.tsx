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
import { instanceStore } from "@/store";
import { instanceSettingNamePrefix } from "@/store/common";
import {
  InstanceSetting_Key,
  InstanceSetting_StorageSetting,
  InstanceSetting_StorageSetting_S3Config,
  InstanceSetting_StorageSetting_StorageType,
} from "@/types/proto/api/v1/instance_service";
import { useTranslate } from "@/utils/i18n";

const StorageSection = observer(() => {
  const t = useTranslate();
  const [instanceStorageSetting, setInstanceStorageSetting] = useState<InstanceSetting_StorageSetting>(
    InstanceSetting_StorageSetting.fromPartial(instanceStore.getInstanceSettingByKey(InstanceSetting_Key.STORAGE)?.storageSetting || {}),
  );

  useEffect(() => {
    setInstanceStorageSetting(
      InstanceSetting_StorageSetting.fromPartial(instanceStore.getInstanceSettingByKey(InstanceSetting_Key.STORAGE)?.storageSetting || {}),
    );
  }, [instanceStore.getInstanceSettingByKey(InstanceSetting_Key.STORAGE)]);

  const allowSaveStorageSetting = useMemo(() => {
    if (instanceStorageSetting.uploadSizeLimitMb <= 0) {
      return false;
    }

    const origin = InstanceSetting_StorageSetting.fromPartial(
      instanceStore.getInstanceSettingByKey(InstanceSetting_Key.STORAGE)?.storageSetting || {},
    );
    if (instanceStorageSetting.storageType === InstanceSetting_StorageSetting_StorageType.LOCAL) {
      if (instanceStorageSetting.filepathTemplate.length === 0) {
        return false;
      }
    } else if (instanceStorageSetting.storageType === InstanceSetting_StorageSetting_StorageType.S3) {
      if (
        instanceStorageSetting.s3Config?.accessKeyId.length === 0 ||
        instanceStorageSetting.s3Config?.accessKeySecret.length === 0 ||
        instanceStorageSetting.s3Config?.endpoint.length === 0 ||
        instanceStorageSetting.s3Config?.region.length === 0 ||
        instanceStorageSetting.s3Config?.bucket.length === 0
      ) {
        return false;
      }
    }
    return !isEqual(origin, instanceStorageSetting);
  }, [instanceStorageSetting, instanceStore.state]);

  const handleMaxUploadSizeChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    let num = parseInt(event.target.value);
    if (Number.isNaN(num)) {
      num = 0;
    }
    const update: InstanceSetting_StorageSetting = {
      ...instanceStorageSetting,
      uploadSizeLimitMb: num,
    };
    setInstanceStorageSetting(update);
  };

  const handleFilepathTemplateChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    const update: InstanceSetting_StorageSetting = {
      ...instanceStorageSetting,
      filepathTemplate: event.target.value,
    };
    setInstanceStorageSetting(update);
  };

  const handlePartialS3ConfigChanged = async (s3Config: Partial<InstanceSetting_StorageSetting_S3Config>) => {
    const update: InstanceSetting_StorageSetting = {
      ...instanceStorageSetting,
      s3Config: InstanceSetting_StorageSetting_S3Config.fromPartial({
        ...instanceStorageSetting.s3Config,
        ...s3Config,
      }),
    };
    setInstanceStorageSetting(update);
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

  const handleStorageTypeChanged = async (storageType: InstanceSetting_StorageSetting_StorageType) => {
    const update: InstanceSetting_StorageSetting = {
      ...instanceStorageSetting,
      storageType: storageType,
    };
    setInstanceStorageSetting(update);
  };

  const saveInstanceStorageSetting = async () => {
    await instanceStore.upsertInstanceSetting({
      name: `${instanceSettingNamePrefix}${InstanceSetting_Key.STORAGE}`,
      storageSetting: instanceStorageSetting,
    });
    toast.success("Updated");
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <div className="font-medium text-muted-foreground">{t("setting.storage-section.current-storage")}</div>
      <RadioGroup
        value={instanceStorageSetting.storageType}
        onValueChange={(value) => {
          handleStorageTypeChanged(value as InstanceSetting_StorageSetting_StorageType);
        }}
        className="flex flex-row gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value={InstanceSetting_StorageSetting_StorageType.DATABASE} id="database" />
          <Label htmlFor="database">{t("setting.storage-section.type-database")}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value={InstanceSetting_StorageSetting_StorageType.LOCAL} id="local" />
          <Label htmlFor="local">{t("setting.storage-section.type-local")}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value={InstanceSetting_StorageSetting_StorageType.S3} id="s3" />
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
        <Input className="w-16 font-mono" value={instanceStorageSetting.uploadSizeLimitMb} onChange={handleMaxUploadSizeChanged} />
      </div>
      {instanceStorageSetting.storageType !== InstanceSetting_StorageSetting_StorageType.DATABASE && (
        <div className="w-full flex flex-row justify-between items-center">
          <span className="text-muted-foreground mr-1">{t("setting.storage-section.filepath-template")}</span>
          <Input
            className="w-64"
            value={instanceStorageSetting.filepathTemplate}
            placeholder="assets/{timestamp}_{filename}"
            onChange={handleFilepathTemplateChanged}
          />
        </div>
      )}
      {instanceStorageSetting.storageType === InstanceSetting_StorageSetting_StorageType.S3 && (
        <>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Access key id</span>
            <Input
              className="w-64"
              value={instanceStorageSetting.s3Config?.accessKeyId}
              placeholder=""
              onChange={handleS3ConfigAccessKeyIdChanged}
            />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Access key secret</span>
            <Input
              className="w-64"
              value={instanceStorageSetting.s3Config?.accessKeySecret}
              placeholder=""
              onChange={handleS3ConfigAccessKeySecretChanged}
            />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Endpoint</span>
            <Input
              className="w-64"
              value={instanceStorageSetting.s3Config?.endpoint}
              placeholder=""
              onChange={handleS3ConfigEndpointChanged}
            />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Region</span>
            <Input className="w-64" value={instanceStorageSetting.s3Config?.region} placeholder="" onChange={handleS3ConfigRegionChanged} />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Bucket</span>
            <Input className="w-64" value={instanceStorageSetting.s3Config?.bucket} placeholder="" onChange={handleS3ConfigBucketChanged} />
          </div>
          <div className="w-full flex flex-row justify-between items-center">
            <span className="text-muted-foreground mr-1">Use Path Style</span>
            <Switch
              checked={instanceStorageSetting.s3Config?.usePathStyle}
              onCheckedChange={(checked) => handleS3ConfigUsePathStyleChanged({ target: { checked } } as any)}
            />
          </div>
        </>
      )}
      <div>
        <Button disabled={!allowSaveStorageSetting} onClick={saveInstanceStorageSetting}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
});

export default StorageSection;
