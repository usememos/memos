import { Button, Input, Switch, Select, Option } from "@mui/joy";
import { isEqual } from "lodash-es";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { workspaceSettingNamePrefix, useWorkspaceSettingStore } from "@/store/v1";
import { Visibility } from "@/types/proto/api/v1/memo_service";
import { WorkspaceMemoRelatedSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";
import { convertVisibilityFromString, convertVisibilityToString } from "@/utils/memo";
import VisibilityIcon from "../VisibilityIcon";

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
    try {
      await workspaceSettingStore.setWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSettingKey.MEMO_RELATED}`,
        memoRelatedSetting,
      });
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
      return;
    }
    toast.success(t("message.update-succeed"));
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-gray-700 dark:text-gray-500">Memo related settings</p>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.disable-public-memos")}</span>
        <Switch
          checked={memoRelatedSetting.disallowPublicVisibility}
          onChange={(event) => updatePartialSetting({ disallowPublicVisibility: event.target.checked })}
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
        <span>Enable link preview</span>
        <Switch
          checked={memoRelatedSetting.enableLinkPreview}
          onChange={(event) => updatePartialSetting({ enableLinkPreview: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>Enable memo comments</span>
        <Switch
          checked={memoRelatedSetting.enableComment}
          onChange={(event) => updatePartialSetting({ enableComment: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>Enable memo location</span>
        <Switch
          checked={memoRelatedSetting.enableLocation}
          onChange={(event) => updatePartialSetting({ enableLocation: event.target.checked })}
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
      <div className="w-full flex flex-row justify-between items-center">
        <span className="truncate">{t("setting.preference-section.default-memo-visibility")}</span>
        <Select
          className="!min-w-fit"
          value={memoRelatedSetting.memoVisibility}
          startDecorator={<VisibilityIcon visibility={convertVisibilityFromString(memoRelatedSetting.memoVisibility)} />}
          onChange={(_, visibility) => {
            updatePartialSetting({ memoVisibility: visibility || Visibility.PRIVATE });
          }}
        >
          {[Visibility.PRIVATE, Visibility.PROTECTED, Visibility.PUBLIC]
            .map((v) => convertVisibilityToString(v))
            .map((item) => (
              <Option key={item} value={item} className="whitespace-nowrap">
                {t(`memo.visibility.${item.toLowerCase() as Lowercase<typeof item>}`)}
              </Option>
            ))}
        </Select>
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
