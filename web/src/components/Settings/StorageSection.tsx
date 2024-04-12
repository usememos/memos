import {
  Button,
  Divider,
  Dropdown,
  IconButton,
  Input,
  List,
  ListItem,
  Menu,
  MenuButton,
  MenuItem,
  Radio,
  RadioGroup,
  Tooltip,
} from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import * as api from "@/helpers/api";
import { WorkspaceSettingPrefix, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceStorageSetting, WorkspaceStorageSetting_StorageType } from "@/types/proto/api/v2/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";
import showCreateStorageServiceDialog from "../CreateStorageServiceDialog";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";
import LearnMore from "../LearnMore";
import showUpdateLocalStorageDialog from "../UpdateLocalStorageDialog";

const StorageSection = () => {
  const t = useTranslate();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const [storageList, setStorageList] = useState<ObjectStorage[]>([]);
  const [workspaceStorageSetting, setWorkspaceStorageSetting] = useState<WorkspaceStorageSetting>(
    WorkspaceStorageSetting.fromPartial(
      workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.WORKSPACE_SETTING_STORAGE)?.storageSetting || {},
    ),
  );

  useEffect(() => {
    fetchStorageList();
  }, []);

  const fetchStorageList = async () => {
    const { data: storageList } = await api.getStorageList();
    setStorageList(storageList);
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
    workspaceSettingStore.setWorkspaceSetting({
      name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.WORKSPACE_SETTING_STORAGE}`,
      storageSetting: update,
    });
  };

  const handleStorageTypeChanged = async (storageType: WorkspaceStorageSetting_StorageType) => {
    const update: WorkspaceStorageSetting = {
      ...workspaceStorageSetting,
      storageType: storageType,
    };
    setWorkspaceStorageSetting(update);
    await workspaceSettingStore.setWorkspaceSetting({
      name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.WORKSPACE_SETTING_STORAGE}`,
      storageSetting: update,
    });
  };

  const handleActivedExternalStorageIdChanged = async (activedExternalStorageId: number) => {
    const update: WorkspaceStorageSetting = {
      ...workspaceStorageSetting,
      activedExternalStorageId: activedExternalStorageId,
    };
    setWorkspaceStorageSetting(update);
    await workspaceSettingStore.setWorkspaceSetting({
      name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.WORKSPACE_SETTING_STORAGE}`,
      storageSetting: update,
    });
  };

  const handleDeleteStorage = (storage: ObjectStorage) => {
    showCommonDialog({
      title: t("setting.storage-section.delete-storage"),
      content: t("setting.storage-section.warning-text", { name: storage.name }),
      style: "danger",
      dialogName: "delete-storage-dialog",
      onConfirm: async () => {
        try {
          await api.deleteStorage(storage.id);
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
      <div className="w-full flex flex-row justify-start items-center">
        <span className="font-mono text-sm text-gray-400 mr-2 dark:text-gray-500">{t("setting.storage-section.current-storage")}</span>
      </div>
      <RadioGroup
        className="w-full"
        value={workspaceStorageSetting.storageType}
        onChange={(event) => {
          handleStorageTypeChanged(event.target.value as WorkspaceStorageSetting_StorageType);
        }}
      >
        <Radio value={WorkspaceStorageSetting_StorageType.STORAGE_TYPE_DATABASE} label={t("setting.storage-section.type-database")} />
        <div>
          <Radio value={WorkspaceStorageSetting_StorageType.STORAGE_TYPE_LOCAL} label={t("setting.storage-section.type-local")} />
          <IconButton size="sm" onClick={() => showUpdateLocalStorageDialog()}>
            <Icon.PenBox className="w-4 h-auto" />
          </IconButton>
        </div>
        <Radio value={WorkspaceStorageSetting_StorageType.STORAGE_TYPE_EXTERNAL} label={"S3"} />
      </RadioGroup>
      <RadioGroup
        className="w-full"
        value={workspaceStorageSetting.activedExternalStorageId}
        onChange={(event) => {
          handleActivedExternalStorageIdChanged(Number(event.target.value));
        }}
      >
        {storageList.map((storage) => (
          <Radio key={storage.id} value={storage.id} label={storage.name} />
        ))}
      </RadioGroup>
      <div className="w-full flex flex-row justify-between items-center">
        <div className="flex flex-row items-center">
          <span className="mr-1">{t("setting.system-section.max-upload-size")}</span>
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
              <p className="ml-2">{storage.name}</p>
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
