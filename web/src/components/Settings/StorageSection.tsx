import {
  Button,
  Divider,
  Dropdown,
  Input,
  List,
  ListItem,
  Menu,
  MenuButton,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Tooltip,
  Option,
} from "@mui/joy";
import { isEqual } from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { storageServiceClient } from "@/grpcweb";
import { WorkspaceSettingPrefix, useWorkspaceSettingStore } from "@/store/v1";
import { Storage } from "@/types/proto/api/v2/storage_service";
import { WorkspaceStorageSetting, WorkspaceStorageSetting_StorageType } from "@/types/proto/api/v2/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";
import showCreateStorageServiceDialog from "../CreateStorageServiceDialog";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";
import LearnMore from "../LearnMore";

const StorageSection = () => {
  const t = useTranslate();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const [storageList, setStorageList] = useState<Storage[]>([]);
  const [workspaceStorageSetting, setWorkspaceStorageSetting] = useState<WorkspaceStorageSetting>(
    WorkspaceStorageSetting.fromPartial(
      workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.WORKSPACE_SETTING_STORAGE)?.storageSetting || {},
    ),
  );

  const allowSaveStorageSetting = useMemo(() => {
    if (workspaceStorageSetting.uploadSizeLimitMb <= 0) {
      return false;
    }

    const origin = WorkspaceStorageSetting.fromPartial(
      workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.WORKSPACE_SETTING_STORAGE)?.storageSetting || {},
    );
    if (workspaceStorageSetting.storageType === WorkspaceStorageSetting_StorageType.STORAGE_TYPE_LOCAL) {
      if (workspaceStorageSetting.localStoragePathTemplate.length === 0) {
        return false;
      }
    } else if (workspaceStorageSetting.storageType === WorkspaceStorageSetting_StorageType.STORAGE_TYPE_EXTERNAL) {
      if (!workspaceStorageSetting.activedExternalStorageId || workspaceStorageSetting.activedExternalStorageId === 0) {
        return false;
      }
    }
    return !isEqual(origin, workspaceStorageSetting);
  }, [workspaceStorageSetting, workspaceSettingStore.getState()]);

  useEffect(() => {
    fetchStorageList();
  }, []);

  const fetchStorageList = async () => {
    const { storages } = await storageServiceClient.listStorages({});
    setStorageList(storages);
  };

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

  const handleLocalStoragePathTemplateChanged = async (event: React.FocusEvent<HTMLInputElement>) => {
    const update: WorkspaceStorageSetting = {
      ...workspaceStorageSetting,
      localStoragePathTemplate: event.target.value,
    };
    setWorkspaceStorageSetting(update);
  };

  const handleStorageTypeChanged = async (storageType: WorkspaceStorageSetting_StorageType) => {
    const update: WorkspaceStorageSetting = {
      ...workspaceStorageSetting,
      storageType: storageType,
    };
    setWorkspaceStorageSetting(update);
  };

  const handleActivedExternalStorageIdChanged = async (activedExternalStorageId: number) => {
    const update: WorkspaceStorageSetting = {
      ...workspaceStorageSetting,
      activedExternalStorageId: activedExternalStorageId,
    };
    setWorkspaceStorageSetting(update);
  };

  const saveWorkspaceStorageSetting = async () => {
    await workspaceSettingStore.setWorkspaceSetting({
      name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.WORKSPACE_SETTING_STORAGE}`,
      storageSetting: workspaceStorageSetting,
    });
    toast.success("Updated");
  };

  const handleDeleteStorage = (storage: Storage) => {
    showCommonDialog({
      title: t("setting.storage-section.delete-storage"),
      content: t("setting.storage-section.warning-text", { name: storage.title }),
      style: "danger",
      dialogName: "delete-storage-dialog",
      onConfirm: async () => {
        try {
          await storageServiceClient.deleteStorage({ id: storage.id });
        } catch (error: any) {
          console.error(error);
          toast.error(error.response.data.message);
        }
        await fetchStorageList();
      },
    });
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
        <Radio value={WorkspaceStorageSetting_StorageType.STORAGE_TYPE_DATABASE} label={t("setting.storage-section.type-database")} />
        <Radio value={WorkspaceStorageSetting_StorageType.STORAGE_TYPE_LOCAL} label={t("setting.storage-section.type-local")} />
        <Radio value={WorkspaceStorageSetting_StorageType.STORAGE_TYPE_EXTERNAL} disabled={storageList.length === 0} label={"S3"} />
      </RadioGroup>
      <div className="w-full flex flex-row justify-between items-center">
        <div className="flex flex-row items-center">
          <span className="text-gray-700 dark:text-gray-500 mr-1">{t("setting.system-section.max-upload-size")}</span>
          <Tooltip title={t("setting.system-section.max-upload-size-hint")} placement="top">
            <Icon.HelpCircle className="w-4 h-auto" />
          </Tooltip>
        </div>
        <Input
          className="w-16"
          sx={{
            fontFamily: "monospace",
          }}
          defaultValue={workspaceStorageSetting.uploadSizeLimitMb}
          onChange={handleMaxUploadSizeChanged}
        />
      </div>
      {workspaceStorageSetting.storageType === WorkspaceStorageSetting_StorageType.STORAGE_TYPE_LOCAL && (
        <div className="w-full flex flex-row justify-between items-center">
          <span className="text-gray-700 dark:text-gray-500 mr-1">Local file path template</span>
          <Input
            defaultValue={workspaceStorageSetting.localStoragePathTemplate}
            placeholder="assets/{timestamp}_{filename}"
            onChange={handleLocalStoragePathTemplateChanged}
          />
        </div>
      )}
      {workspaceStorageSetting.storageType === WorkspaceStorageSetting_StorageType.STORAGE_TYPE_EXTERNAL && (
        <div className="w-full flex flex-row justify-between items-center">
          <span className="text-gray-700 dark:text-gray-500 mr-1">Actived storage</span>
          <Select
            onChange={(_, value) => handleActivedExternalStorageIdChanged(value as number)}
            defaultValue={workspaceStorageSetting.activedExternalStorageId}
          >
            {storageList.map((storage) => (
              <Option key={storage.id} value={storage.id}>
                {storage.title}
              </Option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <Button disabled={!allowSaveStorageSetting} onClick={saveWorkspaceStorageSetting}>
          {t("common.save")}
        </Button>
      </div>
      <Divider className="!my-2" />
      <div className="mb-2 w-full flex flex-row justify-between items-center gap-1">
        <div className="flex items-center gap-1">
          <span className="font-mono text-sm text-gray-400">{t("setting.storage-section.storage-services")}</span>
          <LearnMore url="https://usememos.com/docs/advanced-settings/cloudflare-r2" />
        </div>
        <Button onClick={() => showCreateStorageServiceDialog(undefined, fetchStorageList)}>{t("common.create")}</Button>
      </div>
      <div className="w-full flex flex-col">
        {storageList.map((storage) => (
          <div
            key={storage.id}
            className="py-2 w-full border-t last:border-b dark:border-zinc-700 flex flex-row items-center justify-between"
          >
            <div className="flex flex-row items-center">
              <p className="ml-2">{storage.title}</p>
            </div>
            <div className="flex flex-row items-center">
              <Dropdown>
                <MenuButton size="sm">
                  <Icon.MoreVertical className="w-4 h-auto" />
                </MenuButton>
                <Menu placement="bottom-end" size="sm">
                  <MenuItem onClick={() => showCreateStorageServiceDialog(storage, fetchStorageList)}>{t("common.edit")}</MenuItem>
                  <MenuItem onClick={() => handleDeleteStorage(storage)}>{t("common.delete")}</MenuItem>
                </Menu>
              </Dropdown>
            </div>
          </div>
        ))}
        {storageList.length === 0 && (
          <div className="w-full text-sm dark:border-zinc-700 opacity-60 flex flex-row items-center justify-between">
            <p className="">No storage service found.</p>
          </div>
        )}
      </div>
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
