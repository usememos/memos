import { Select, Textarea, Option, Divider, Switch } from "@mui/joy";
import { Button } from "@usememos/mui";
import { isEqual } from "lodash-es";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { workspaceSettingNamePrefix, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceGeneralSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";
import showUpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";

const WorkspaceSection = () => {
  const t = useTranslate();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const originalSetting = WorkspaceGeneralSetting.fromPartial(
    workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.GENERAL)?.generalSetting || {},
  );
  const [workspaceGeneralSetting, setWorkspaceGeneralSetting] = useState<WorkspaceGeneralSetting>(originalSetting);

  useEffect(() => {
    setWorkspaceGeneralSetting(originalSetting);
  }, [workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.GENERAL)]);

  const handleUpdateCustomizedProfileButtonClick = () => {
    showUpdateCustomizedProfileDialog();
  };

  const updatePartialSetting = (partial: Partial<WorkspaceGeneralSetting>) => {
    setWorkspaceGeneralSetting(
      WorkspaceGeneralSetting.fromPartial({
        ...workspaceGeneralSetting,
        ...partial,
      }),
    );
  };

  const handleSaveGeneralSetting = async () => {
    try {
      await workspaceSettingStore.setWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSettingKey.GENERAL}`,
        generalSetting: workspaceGeneralSetting,
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
      <p className="font-medium text-gray-700 dark:text-gray-500">{t("common.basic")}</p>
      <div className="w-full flex flex-row justify-between items-center">
        <div>
          {t("setting.system-section.server-name")}:{" "}
          <span className="font-mono font-bold">{workspaceGeneralSetting.customProfile?.title || "Memos"}</span>
        </div>
        <Button variant="outlined" onClick={handleUpdateCustomizedProfileButtonClick}>
          {t("common.edit")}
        </Button>
      </div>
      <Divider />
      <p className="font-medium text-gray-700 dark:text-gray-500">General</p>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.additional-style")}</span>
      </div>
      <Textarea
        className="w-full"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        minRows={2}
        maxRows={4}
        placeholder={t("setting.system-section.additional-style-placeholder")}
        value={workspaceGeneralSetting.additionalStyle}
        onChange={(event) => updatePartialSetting({ additionalStyle: event.target.value })}
      />
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.additional-script")}</span>
      </div>
      <Textarea
        className="w-full"
        color="neutral"
        sx={{
          fontFamily: "monospace",
          fontSize: "14px",
        }}
        minRows={2}
        maxRows={4}
        placeholder={t("setting.system-section.additional-script-placeholder")}
        value={workspaceGeneralSetting.additionalScript}
        onChange={(event) => updatePartialSetting({ additionalScript: event.target.value })}
      />
      <div className="w-full">
        <Link
          className="text-gray-500 text-sm flex flex-row justify-start items-center hover:underline hover:text-blue-600"
          to="https://usememos.com/docs/advanced-settings/custom-style-and-script"
          target="_blank"
        >
          {t("common.learn-more")}
          <ExternalLinkIcon className="inline w-4 h-auto ml-1" />
        </Link>
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.workspace-section.disallow-user-registration")}</span>
        <Switch
          checked={workspaceGeneralSetting.disallowUserRegistration}
          onChange={(event) => updatePartialSetting({ disallowUserRegistration: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.workspace-section.disallow-password-auth")}</span>
        <Switch
          checked={workspaceGeneralSetting.disallowPasswordAuth}
          onChange={(event) => updatePartialSetting({ disallowPasswordAuth: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.workspace-section.disallow-change-username")}</span>
        <Switch
          checked={workspaceGeneralSetting.disallowChangeUsername}
          onChange={(event) => updatePartialSetting({ disallowChangeUsername: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.workspace-section.disallow-change-nickname")}</span>
        <Switch
          checked={workspaceGeneralSetting.disallowChangeNickname}
          onChange={(event) => updatePartialSetting({ disallowChangeNickname: event.target.checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span className="truncate">{t("setting.workspace-section.week-start-day")}</span>
        <Select
          className="!min-w-fit"
          value={workspaceGeneralSetting.weekStartDayOffset}
          onChange={(_, weekStartDayOffset) => {
            updatePartialSetting({ weekStartDayOffset: weekStartDayOffset || 0 });
          }}
        >
          <Option value={-1}>{t("setting.workspace-section.saturday")}</Option>
          <Option value={0}>{t("setting.workspace-section.sunday")}</Option>
          <Option value={1}>{t("setting.workspace-section.monday")}</Option>
        </Select>
      </div>
      <div className="mt-2 w-full flex justify-end">
        <Button color="primary" disabled={isEqual(workspaceGeneralSetting, originalSetting)} onClick={handleSaveGeneralSetting}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
};

export default WorkspaceSection;
