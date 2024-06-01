import { Button, Input, Switch } from "@mui/joy";
import { isEqual } from "lodash-es";
import { useState } from "react";
import { WorkspaceSettingPrefix, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceMemoRelatedSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";

const MemoRelatedSettings = () => {
  const t = useTranslate();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const originalSetting = WorkspaceMemoRelatedSetting.fromPartial(
    workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.MEMO_RELATED)?.memoRelatedSetting || {},
  );
  const [memoRelatedSetting, setMemoRelatedSetting] = useState<WorkspaceMemoRelatedSetting>(originalSetting);

  const updatePartialSetting = (partial: Partial<WorkspaceMemoRelatedSetting>) => {
    const newWorkspaceMemoRelatedSetting = WorkspaceMemoRelatedSetting.fromPartial({
      ...memoRelatedSetting,
      ...partial,
    });
    setMemoRelatedSetting(newWorkspaceMemoRelatedSetting);
  };

  const updateSetting = async () => {
    await workspaceSettingStore.setWorkspaceSetting({
      name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.MEMO_RELATED}`,
      memoRelatedSetting,
    });
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-gray-700 dark:text-gray-500">Memo related settings</p>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.disable-public-memos")}</span>
        <Switch
          checked={memoRelatedSetting.disallowPublicVisible}
          onChange={(event) => updatePartialSetting({ disallowPublicVisible: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.display-with-updated-time")}</span>
        <Switch
          checked={memoRelatedSetting.displayWithUpdateTime}
          onChange={(event) => updatePartialSetting({ displayWithUpdateTime: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.enable-auto-compact")}</span>
        <Switch
          checked={memoRelatedSetting.enableAutoCompact}
          onChange={(event) => updatePartialSetting({ enableAutoCompact: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.enable-double-click-to-edit")}</span>
        <Switch
          checked={memoRelatedSetting.enableDoubleClickEdit}
          onChange={(event) => updatePartialSetting({ enableDoubleClickEdit: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>Content length limit(Byte)</span>
        <Input
          className="w-24"
          type="number"
          defaultValue={memoRelatedSetting.contentLengthLimit}
          onBlur={(event) => updatePartialSetting({ contentLengthLimit: Number(event.target.value) })}
        />
      </div>
      <div className="mt-2 w-full flex justify-end">
        <Button disabled={isEqual(memoRelatedSetting, originalSetting)} onClick={updateSetting}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
};

export default MemoRelatedSettings;
