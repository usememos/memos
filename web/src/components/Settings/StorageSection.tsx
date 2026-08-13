import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { CloudIcon, DatabaseIcon, FolderIcon, LucideIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useInstance } from "@/contexts/InstanceContext";
import { cn } from "@/lib/utils";
import {
  InstanceSetting_Key,
  InstanceSetting_Storage,
  InstanceSetting_Storage_S3Config,
  InstanceSetting_Storage_S3ConfigSchema,
  InstanceSetting_StorageSchema,
  InstanceSetting_StorageSetting,
  InstanceSetting_StorageSetting_S3Config,
  InstanceSetting_StorageSettingSchema,
  InstanceSetting_StorageType,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingPanel } from "./SettingList";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";
import useInstanceSettingUpdater, { buildInstanceSettingName } from "./useInstanceSettingUpdater";

const DEFAULT_FILEPATH_TEMPLATE = "assets/{timestamp}_{uuid}_{filename}";

type StorageTypeOption = {
  storageType: InstanceSetting_StorageType;
  id: string;
  titleKey: "setting.storage.type-database" | "setting.storage.type-local" | "setting.storage.type-s3";
  descriptionKey: "setting.storage.database-description" | "setting.storage.local-description" | "setting.storage.s3-description";
  noteKeys: readonly [
    "setting.storage.database-note-backup" | "setting.storage.local-note-path" | "setting.storage.s3-note-scale",
    "setting.storage.database-note-size" | "setting.storage.local-note-backup" | "setting.storage.s3-note-config",
  ];
  icon: LucideIcon;
  badges?: readonly ("setting.storage.badge-default" | "setting.storage.badge-recommended")[];
};

const storageTypeOptions: StorageTypeOption[] = [
  {
    storageType: InstanceSetting_StorageType.LOCAL,
    id: "storage-type-local",
    titleKey: "setting.storage.type-local",
    descriptionKey: "setting.storage.local-description",
    noteKeys: ["setting.storage.local-note-path", "setting.storage.local-note-backup"],
    icon: FolderIcon,
    badges: ["setting.storage.badge-default", "setting.storage.badge-recommended"],
  },
  {
    storageType: InstanceSetting_StorageType.DATABASE,
    id: "storage-type-database",
    titleKey: "setting.storage.type-database",
    descriptionKey: "setting.storage.database-description",
    noteKeys: ["setting.storage.database-note-backup", "setting.storage.database-note-size"],
    icon: DatabaseIcon,
  },
  {
    storageType: InstanceSetting_StorageType.S3,
    id: "storage-type-s3",
    titleKey: "setting.storage.type-s3",
    descriptionKey: "setting.storage.s3-description",
    noteKeys: ["setting.storage.s3-note-scale", "setting.storage.s3-note-config"],
    icon: CloudIcon,
  },
];

const getDefaultStorage = (setting: InstanceSetting_StorageSetting): InstanceSetting_Storage | undefined =>
  setting.storages.find((storage) => storage.id === setting.defaultStorageId);

const getSelectedStorageType = (setting: InstanceSetting_StorageSetting): InstanceSetting_StorageType =>
  getDefaultStorage(setting)?.type ?? (setting.storageType as number as InstanceSetting_StorageType);

const getS3Config = (
  setting: InstanceSetting_StorageSetting,
): InstanceSetting_Storage_S3Config | InstanceSetting_StorageSetting_S3Config | undefined => {
  const storage = getDefaultStorage(setting);
  if (storage?.config.case === "s3Config") {
    return storage.config.value;
  }
  return setting.s3Config;
};

// The server keeps the storage registry ordered by most recent activation, so
// the first storage of a type is the most recently used one.
const findStorageForType = (
  setting: InstanceSetting_StorageSetting,
  storageType: InstanceSetting_StorageType,
): InstanceSetting_Storage | undefined => setting.storages.find((storage) => storage.type === storageType);

const normalizeEndpoint = (endpoint: string): string => endpoint.trim().replace(/\/+$/, "");

const hasReusableS3Credential = (
  setting: InstanceSetting_StorageSetting,
  target: InstanceSetting_Storage_S3Config | InstanceSetting_StorageSetting_S3Config | undefined,
): boolean => {
  if (!target) {
    return false;
  }
  // A credential can authorize multiple buckets, so match its provider scope
  // rather than requiring the exact storage namespace.
  const existingConfigs: (InstanceSetting_Storage_S3Config | InstanceSetting_StorageSetting_S3Config)[] = setting.storages
    .map((storage) => (storage.config.case === "s3Config" ? storage.config.value : undefined))
    .filter((config): config is InstanceSetting_Storage_S3Config => config !== undefined);
  if (setting.s3Config) {
    existingConfigs.push(setting.s3Config);
  }
  return existingConfigs.some(
    (config) =>
      config.accessKeyId === target.accessKeyId &&
      normalizeEndpoint(config.endpoint) === normalizeEndpoint(target.endpoint) &&
      config.region.trim() === target.region.trim(),
  );
};

const createStorage = (storageType: InstanceSetting_StorageType): InstanceSetting_Storage => {
  const storageTypeName = InstanceSetting_StorageType[storageType];
  const id = storageType === InstanceSetting_StorageType.S3 ? `s3-${uuidv4()}` : storageTypeName.toLowerCase();
  return create(InstanceSetting_StorageSchema, {
    id,
    name: storageType === InstanceSetting_StorageType.S3 ? "S3" : `${storageTypeName[0]}${storageTypeName.slice(1).toLowerCase()}`,
    type: storageType,
    config:
      storageType === InstanceSetting_StorageType.S3
        ? { case: "s3Config", value: create(InstanceSetting_Storage_S3ConfigSchema, {}) }
        : { case: undefined },
  });
};

// Browsing the storage-type options creates placeholder entries so the form has
// something to select and edit. Only the selected storage and entries the server
// already knows deserve to be persisted; abandoned placeholders are dropped.
const canonicalizeStorageSetting = (
  setting: InstanceSetting_StorageSetting,
  original: InstanceSetting_StorageSetting,
): InstanceSetting_StorageSetting => {
  const originalIds = new Set(original.storages.map((storage) => storage.id));
  return create(InstanceSetting_StorageSettingSchema, {
    ...setting,
    storages: setting.storages.filter((storage) => storage.id === setting.defaultStorageId || originalIds.has(storage.id)),
  });
};

const StorageSection = () => {
  const t = useTranslate();
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { storageSetting: originalSetting } = useInstance();
  const [instanceStorageSetting, setInstanceStorageSetting] = useState<InstanceSetting_StorageSetting>(originalSetting);

  const selectedStorageType = getSelectedStorageType(instanceStorageSetting);
  const selectedS3Config = getS3Config(instanceStorageSetting);
  const canReuseSelectedS3Secret = hasReusableS3Credential(originalSetting, selectedS3Config);

  const selectedStorageOption = useMemo(
    () => storageTypeOptions.find((option) => option.storageType === selectedStorageType) ?? storageTypeOptions[0],
    [selectedStorageType],
  );
  const SelectedStorageIcon = selectedStorageOption.icon;

  useEffect(() => {
    setInstanceStorageSetting(originalSetting);
  }, [originalSetting]);

  const allowSaveStorageSetting = useMemo(() => {
    if (instanceStorageSetting.uploadSizeLimitMb <= 0) {
      return false;
    }

    if (selectedStorageType === InstanceSetting_StorageType.LOCAL) {
      if (instanceStorageSetting.filepathTemplate.length === 0) {
        return false;
      }
    } else if (selectedStorageType === InstanceSetting_StorageType.S3) {
      if (
        !instanceStorageSetting.filepathTemplate ||
        !selectedS3Config?.accessKeyId ||
        (!canReuseSelectedS3Secret && !selectedS3Config?.accessKeySecret) ||
        !selectedS3Config?.endpoint ||
        !selectedS3Config?.region ||
        !selectedS3Config?.bucket
      ) {
        return false;
      }
    }
    return !isEqual(originalSetting, canonicalizeStorageSetting(instanceStorageSetting, originalSetting));
  }, [canReuseSelectedS3Secret, instanceStorageSetting, originalSetting, selectedS3Config, selectedStorageType]);

  const handleMaxUploadSizeChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    let num = parseInt(event.target.value);
    if (Number.isNaN(num)) {
      num = 0;
    }
    setInstanceStorageSetting((current) =>
      create(InstanceSetting_StorageSettingSchema, {
        ...current,
        uploadSizeLimitMb: BigInt(num),
      }),
    );
  };

  const handleFilepathTemplateChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInstanceStorageSetting((current) =>
      create(InstanceSetting_StorageSettingSchema, {
        ...current,
        filepathTemplate: event.target.value,
      }),
    );
  };

  const handleS3FieldChange = (field: keyof InstanceSetting_StorageSetting_S3Config, value: string | boolean) => {
    // Functional update: batched events (e.g. password-manager autofill firing
    // several inputs in one task) must not overwrite one another.
    setInstanceStorageSetting((current) => {
      const existing = getS3Config(current);
      let configuredStorage = getDefaultStorage(current);
      if (configuredStorage?.type !== InstanceSetting_StorageType.S3) {
        configuredStorage = findStorageForType(current, InstanceSetting_StorageType.S3) ?? createStorage(InstanceSetting_StorageType.S3);
      }
      const updatedStorage = create(InstanceSetting_StorageSchema, {
        ...configuredStorage,
        config: {
          case: "s3Config",
          value: create(InstanceSetting_Storage_S3ConfigSchema, {
            accessKeyId: existing?.accessKeyId ?? "",
            accessKeySecret: existing?.accessKeySecret ?? "",
            endpoint: existing?.endpoint ?? "",
            region: existing?.region ?? "",
            bucket: existing?.bucket ?? "",
            usePathStyle: existing?.usePathStyle ?? false,
            insecureSkipTlsVerify: existing?.insecureSkipTlsVerify ?? false,
            [field]: value,
          }),
        },
      });
      // Replace in place to preserve the registry order the server maintains.
      // The legacy storageType/s3Config mirror fields are left untouched: the
      // server re-derives them from the named model on every update.
      const storages = current.storages.some((storage) => storage.id === updatedStorage.id)
        ? current.storages.map((storage) => (storage.id === updatedStorage.id ? updatedStorage : storage))
        : [updatedStorage, ...current.storages];
      return create(InstanceSetting_StorageSettingSchema, {
        ...current,
        storages,
        defaultStorageId: updatedStorage.id,
      });
    });
  };

  const handleStorageTypeChanged = (storageType: InstanceSetting_StorageType) => {
    setInstanceStorageSetting((current) => {
      const configuredStorage = findStorageForType(current, storageType) ?? createStorage(storageType);
      const storages = current.storages.some((storage) => storage.id === configuredStorage.id)
        ? current.storages
        : [...current.storages, configuredStorage];
      return create(InstanceSetting_StorageSettingSchema, {
        ...current,
        storages,
        defaultStorageId: configuredStorage.id,
        filepathTemplate: current.filepathTemplate || DEFAULT_FILEPATH_TEMPLATE,
      });
    });
  };

  const saveInstanceStorageSetting = async () => {
    await saveInstanceSetting({
      key: InstanceSetting_Key.STORAGE,
      setting: create(InstanceSettingSchema, {
        name: buildInstanceSettingName(InstanceSetting_Key.STORAGE),
        value: {
          case: "storageSetting",
          value: canonicalizeStorageSetting(instanceStorageSetting, originalSetting),
        },
      }),
      errorContext: "Update storage settings",
    });
  };

  return (
    <SettingSection title={t("setting.storage.label")}>
      <SettingGroup title={t("setting.storage.current-storage")} description={t("setting.storage.current-storage-description")}>
        <RadioGroup
          value={String(selectedStorageType)}
          onValueChange={(value) => {
            handleStorageTypeChanged(Number(value) as InstanceSetting_StorageType);
          }}
          className="overflow-hidden rounded-lg border border-border bg-background divide-y divide-border gap-0"
        >
          {storageTypeOptions.map((option) => {
            const Icon = option.icon;
            const selected = selectedStorageType === option.storageType;
            return (
              <div
                key={option.id}
                className={cn(
                  "relative flex border-border bg-background px-3 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg",
                  selected ? "bg-muted/50" : "hover:bg-muted/30",
                )}
              >
                {selected && <div className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
                <div className="flex w-full items-start gap-3">
                  <RadioGroupItem value={String(option.storageType)} id={option.id} className="mt-0.5" />
                  <Label
                    htmlFor={option.id}
                    className="grid min-w-0 flex-1 cursor-pointer gap-2 sm:grid-cols-[minmax(12rem,16rem)_1fr] sm:gap-5"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className={cn("size-4 shrink-0", selected ? "text-foreground" : "text-muted-foreground")} />
                        <span className="truncate text-sm font-medium text-foreground">{t(option.titleKey)}</span>
                      </div>
                      {option.badges && (
                        <div className="flex flex-wrap gap-1.5 pl-6">
                          {option.badges.map((badge) => (
                            <Badge
                              key={badge}
                              variant="outline"
                              className={cn(
                                "rounded-md px-1.5 py-0 text-[10px] font-normal",
                                badge === "setting.storage.badge-recommended" && "border-primary/30 bg-primary/10 text-primary",
                              )}
                            >
                              {t(badge)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-normal leading-5 text-muted-foreground">{t(option.descriptionKey)}</p>
                  </Label>
                </div>
              </div>
            );
          })}
        </RadioGroup>

        <SettingPanel className="rounded-md bg-muted/20 px-3 py-2.5">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <SelectedStorageIcon className="size-3.5" />
            <span>{t("setting.storage.current-storage")}</span>
            <span className="text-foreground">{t(selectedStorageOption.titleKey)}</span>
          </div>
          <ul className="flex flex-col gap-1.5 text-xs leading-5 text-muted-foreground">
            {selectedStorageOption.noteKeys.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-2 size-1 rounded-full bg-muted-foreground/60" aria-hidden />
                <span>{t(note)}</span>
              </li>
            ))}
          </ul>
        </SettingPanel>

        <SettingRow label={t("setting.system.max-upload-size")} tooltip={t("setting.system.max-upload-size-hint")}>
          <Input
            className="w-24 font-mono"
            value={String(instanceStorageSetting.uploadSizeLimitMb)}
            onChange={handleMaxUploadSizeChanged}
          />
        </SettingRow>

        {selectedStorageType !== InstanceSetting_StorageType.DATABASE && (
          <SettingRow
            label={t("setting.storage.filepath-template")}
            description={t("setting.storage.filepath-template-description")}
            vertical
          >
            <Input
              className="w-full max-w-lg font-mono"
              value={instanceStorageSetting.filepathTemplate}
              placeholder={DEFAULT_FILEPATH_TEMPLATE}
              onChange={handleFilepathTemplateChanged}
            />
          </SettingRow>
        )}
      </SettingGroup>

      {selectedStorageType === InstanceSetting_StorageType.S3 && (
        <SettingGroup
          title={t("setting.storage.s3-configuration")}
          description={t("setting.storage.s3-configuration-description")}
          showSeparator
        >
          <SettingRow label={t("setting.storage.accesskey")} description={t("setting.storage.accesskey-description")}>
            <Input
              className="w-64"
              value={selectedS3Config?.accessKeyId ?? ""}
              onChange={(e) => handleS3FieldChange("accessKeyId", e.target.value)}
            />
          </SettingRow>

          <SettingRow
            label={t("setting.storage.secretkey")}
            description={
              canReuseSelectedS3Secret ? t("setting.storage.secretkey-preserve-description") : t("setting.storage.secretkey-description")
            }
          >
            <Input
              className="w-64"
              type="password"
              value={selectedS3Config?.accessKeySecret ?? ""}
              onChange={(e) => handleS3FieldChange("accessKeySecret", e.target.value)}
            />
          </SettingRow>

          <SettingRow label={t("setting.storage.endpoint")} description={t("setting.storage.endpoint-description")}>
            <Input
              className="w-64"
              value={selectedS3Config?.endpoint ?? ""}
              onChange={(e) => handleS3FieldChange("endpoint", e.target.value)}
            />
          </SettingRow>

          <SettingRow label={t("setting.storage.region")} description={t("setting.storage.region-description")}>
            <Input
              className="w-64"
              value={selectedS3Config?.region ?? ""}
              onChange={(e) => handleS3FieldChange("region", e.target.value)}
            />
          </SettingRow>

          <SettingRow label={t("setting.storage.bucket")} description={t("setting.storage.bucket-description")}>
            <Input
              className="w-64"
              value={selectedS3Config?.bucket ?? ""}
              onChange={(e) => handleS3FieldChange("bucket", e.target.value)}
            />
          </SettingRow>

          <SettingRow label={t("setting.storage.use-path-style")} description={t("setting.storage.use-path-style-description")}>
            <Switch
              checked={selectedS3Config?.usePathStyle ?? false}
              onCheckedChange={(checked) => handleS3FieldChange("usePathStyle", checked)}
            />
          </SettingRow>

          <SettingRow
            label={t("setting.storage.insecure-skip-tls-verify")}
            description={t("setting.storage.insecure-skip-tls-verify-description")}
          >
            <Switch
              checked={selectedS3Config?.insecureSkipTlsVerify ?? false}
              onCheckedChange={(checked) => handleS3FieldChange("insecureSkipTlsVerify", checked)}
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
