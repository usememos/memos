import { Button, Select, Textarea, Option, Divider } from "@mui/joy";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { workspaceSettingServiceClient } from "@/grpcweb";
import { workspaceSettingNamePrefix, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceGeneralSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";
import Icon from "../Icon";
import showUpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";

const WorkspaceSection = () => {
  const t = useTranslate();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const [workspaceGeneralSetting, setWorkspaceGeneralSetting] = useState<WorkspaceGeneralSetting>(
    WorkspaceGeneralSetting.fromPartial(workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.GENERAL)?.generalSetting || {}),
  );

  const handleUpdateCustomizedProfileButtonClick = () => {
    showUpdateCustomizedProfileDialog();
  };

  const handleAdditionalStyleChanged = (value: string) => {
    setWorkspaceGeneralSetting({ ...workspaceGeneralSetting, additionalStyle: value });
  };

  const handleAdditionalScriptChanged = (value: string) => {
    setWorkspaceGeneralSetting({ ...workspaceGeneralSetting, additionalScript: value });
  };

  const handleWeekStartDayOffsetChanged = (value: number) => {
    setWorkspaceGeneralSetting({ ...workspaceGeneralSetting, weekStartDayOffset: value });
  };

  const handleSaveGeneralSetting = async () => {
    try {
      await workspaceSettingServiceClient.setWorkspaceSetting({
        setting: {
          name: `${workspaceSettingNamePrefix}${WorkspaceSettingKey.GENERAL}`,
          generalSetting: workspaceGeneralSetting,
        },
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
        <Button variant="outlined" color="neutral" onClick={handleUpdateCustomizedProfileButtonClick}>
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
        onChange={(event) => handleAdditionalStyleChanged(event.target.value)}
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
        onChange={(event) => handleAdditionalScriptChanged(event.target.value)}
      />
      <div className="w-full">
        <Link
          className="text-gray-500 text-sm flex flex-row justify-start items-center hover:underline hover:text-blue-600"
          to="https://usememos.com/docs/advanced-settings/custom-style-and-script"
          target="_blank"
        >
          {t("common.learn-more")}
          <Icon.ExternalLink className="inline w-4 h-auto ml-1" />
        </Link>
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span className="truncate">{t("setting.preference-section.default-memo-visibility")}</span>
        <Select
          className="!min-w-fit"
          value={workspaceGeneralSetting.weekStartDayOffset}
          onChange={(_, weekStartDayOffset) => {
            handleWeekStartDayOffsetChanged(weekStartDayOffset || 0);
          }}
        >
          <Option value={0}>Sunday</Option>
          <Option value={1}>Monday</Option>
        </Select>
      </div>
      <div>
        <Button variant="outlined" color="neutral" onClick={handleSaveGeneralSetting}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
};

export default WorkspaceSection;
