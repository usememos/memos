import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useInstance } from "@/contexts/InstanceContext";
import { handleError } from "@/lib/error";
import {
  InstanceSetting_Key,
  InstanceSetting_StorageSetting,
  InstanceSetting_StorageSetting_S3Config,
  InstanceSetting_StorageSetting_S3ConfigSchema,
  InstanceSetting_StorageSetting_StorageType,
  InstanceSetting_StorageSettingSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const StorageSection = () => {
  const t = useTranslate();
  const { storageSetting: originalSetting, updateSetting, fetchSetting } = useInstance();
  const [instanceStorageSetting, setInstanceStorageSetting] = useState<InstanceSetting_StorageSetting>(originalSetting);

  useEffect(() => {
    setInstanceStorageSetting(originalSetting);
  }, [originalSetting]);

  const allowSaveStorageSetting = useMemo(() => {
    if (instanceStorageSetting.uploadSizeLimitMb <= 0) {
      return false;
    }

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
    return !isEqual(originalSetting, instanceStorageSetting);
  }, [instanceStorageSetting, originalSetting]);

  const handleMaxUploadSizeChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    let num = parseInt(event.target.value);
    if (Number.isNaN(num)) {
      num = 0;
    }
    const update = create(InstanceSetting_StorageSettingSchema, {
      ...instanceStorageSetting,
      uploadSizeLimitMb: BigInt(num),
    });
    setInstanceStorageSetting(update);
  };

  const handleFilepathTemplateChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    const update = create(InstanceSetting_StorageSettingSchema, {
      ...instanceStorageSetting,
      filepathTemplate: event.target.value,
    });
    setInstanceStorageSetting(update);
  };

  const handlePartialS3ConfigChanged = async (s3Config: Partial<InstanceSetting_StorageSetting_S3Config>) => {
    const existingS3Config = instanceStorageSetting.s3Config;
    const s3ConfigInit = {
      accessKeyId: existingS3Config?.accessKeyId ?? "",
      accessKeySecret: existingS3Config?.accessKeySecret ?? "",
      endpoint: existingS3Config?.endpoint ?? "",
      region: existingS3Config?.region ?? "",
      bucket: existingS3Config?.bucket ?? "",
      usePathStyle: existingS3Config?.usePathStyle ?? false,
      ...s3Config,
    };
    const update = create(InstanceSetting_StorageSettingSchema, {
      storageType: instanceStorageSetting.storageType,
      filepathTemplate: instanceStorageSetting.filepathTemplate,
      uploadSizeLimitMb: instanceStorageSetting.uploadSizeLimitMb,
      s3Config: create(InstanceSetting_StorageSetting_S3ConfigSchema, s3ConfigInit),
    });
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
    const update = create(InstanceSetting_StorageSettingSchema, {
      ...instanceStorageSetting,
      storageType: storageType,
    });
    setInstanceStorageSetting(update);
  };

  const saveInstanceStorageSetting = async () => {
    try {
      await updateSetting(
        create(InstanceSettingSchema, {
          name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.STORAGE]}`,
          value: {
            case: "storageSetting",
            value: instanceStorageSetting,
          },
        }),
      );
      await fetchSetting(InstanceSetting_Key.STORAGE);
      toast.success("Updated");
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: "Update storage settings",
      });
    }
  };

  return (
    <SettingSection>
      <SettingGroup title={t("setting.storage-section.current-storage")}>
        <div className="w-full">
          <RadioGroup
            value={String(instanceStorageSetting.storageType)}
            onValueChange={(value) => {
              handleStorageTypeChanged(Number(value) as InstanceSetting_StorageSetting_StorageType);
            }}
            className="flex flex-row gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={String(InstanceSetting_StorageSetting_StorageType.DATABASE)} id="database" />
              <Label htmlFor="database">{t("setting.storage-section.type-database")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={String(InstanceSetting_StorageSetting_StorageType.LOCAL)} id="local" />
              <Label htmlFor="local">{t("setting.storage-section.type-local")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={String(InstanceSetting_StorageSetting_StorageType.S3)} id="s3" />
              <Label htmlFor="s3">S3</Label>
            </div>
          </RadioGroup>
        </div>

        <SettingRow label={t("setting.system-section.max-upload-size")} tooltip={t("setting.system-section.max-upload-size-hint")}>
          <Input
            className="w-24 font-mono"
            value={String(instanceStorageSetting.uploadSizeLimitMb)}
            onChange={handleMaxUploadSizeChanged}
          />
        </SettingRow>

        {instanceStorageSetting.storageType !== InstanceSetting_StorageSetting_StorageType.DATABASE && (
          <SettingRow label={t("setting.storage-section.filepath-template")}>
            <Input
              className="w-64"
              value={instanceStorageSetting.filepathTemplate}
              placeholder="assets/{timestamp}_{filename}"
              onChange={handleFilepathTemplateChanged}
            />
          </SettingRow>
        )}
      </SettingGroup>

      {instanceStorageSetting.storageType === InstanceSetting_StorageSetting_StorageType.S3 && (
        <SettingGroup title="S3 Configuration" showSeparator>
          <SettingRow label="Access key id">
            <Input className="w-64" value={instanceStorageSetting.s3Config?.accessKeyId} onChange={handleS3ConfigAccessKeyIdChanged} />
          </SettingRow>

          <SettingRow label="Access key secret">
            <Input
              className="w-64"
              type="password"
              value={instanceStorageSetting.s3Config?.accessKeySecret}
              onChange={handleS3ConfigAccessKeySecretChanged}
            />
          </SettingRow>

          <SettingRow label="Endpoint">
            <Input className="w-64" value={instanceStorageSetting.s3Config?.endpoint} onChange={handleS3ConfigEndpointChanged} />
          </SettingRow>

          <SettingRow label="Region">
            <Input className="w-64" value={instanceStorageSetting.s3Config?.region} onChange={handleS3ConfigRegionChanged} />
          </SettingRow>

          <SettingRow label="Bucket">
            <Input className="w-64" value={instanceStorageSetting.s3Config?.bucket} onChange={handleS3ConfigBucketChanged} />
          </SettingRow>

          <SettingRow label="Use Path Style">
            <Switch
              checked={instanceStorageSetting.s3Config?.usePathStyle}
              onCheckedChange={(checked) =>
                handleS3ConfigUsePathStyleChanged({ target: { checked } } as React.ChangeEvent<HTMLInputElement> & {
                  target: { checked: boolean };
                })
              }
            />
          </SettingRow>
        </SettingGroup>
      )}

      <div className="w-full flex justify-end">
        <Button disabled={!allowSaveStorageSetting} onClick={saveInstanceStorageSetting}>
          {t("common.save")}
        </Button>
      </div>
    </SettingSection>
  );
};

export default StorageSection;
