import { Button, Switch, Textarea } from "@mui/joy";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { workspaceSettingServiceClient } from "@/grpcweb";
import { WorkspaceSettingPrefix, useWorkspaceSettingStore } from "@/store/v1";
import { WorkspaceGeneralSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { WorkspaceSettingKey } from "@/types/proto/store/workspace_setting";
import { useTranslate } from "@/utils/i18n";
import { showCommonDialog } from "../Dialog/CommonDialog";
import Icon from "../Icon";
import showUpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";

const WorkspaceSection = () => {
  const t = useTranslate();
  const workspaceSettingStore = useWorkspaceSettingStore();
  const [workspaceGeneralSetting, setWorkspaceGeneralSetting] = useState<WorkspaceGeneralSetting>(
    WorkspaceGeneralSetting.fromPartial(workspaceSettingStore.getWorkspaceSettingByKey(WorkspaceSettingKey.GENERAL)?.generalSetting || {}),
  );

  const handleAllowSignUpChanged = async (value: boolean) => {
    const setting = { ...workspaceGeneralSetting, disallowSignup: !value };
    await workspaceSettingServiceClient.setWorkspaceSetting({
      setting: {
        name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.GENERAL}`,
        generalSetting: setting,
      },
    });
    setWorkspaceGeneralSetting(setting);
  };

  const handleDisablePasswordLoginChanged = async (value: boolean) => {
    const updateSetting = async () => {
      const setting = { ...workspaceGeneralSetting, disallowPasswordLogin: value };
      await workspaceSettingServiceClient.setWorkspaceSetting({
        setting: {
          name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.GENERAL}`,
          generalSetting: setting,
        },
      });
      setWorkspaceGeneralSetting(setting);
    };
    if (value) {
      showCommonDialog({
        title: "Confirm",
        content: "Are you sure to disable password login?",
        style: "danger",
        dialogName: "disable-password-login-dialog",
        onConfirm: async () => {
          await updateSetting();
        },
      });
    } else {
      await updateSetting();
    }
  };

  const handleUpdateCustomizedProfileButtonClick = () => {
    showUpdateCustomizedProfileDialog();
  };

  const handleAdditionalStyleChanged = (value: string) => {
    setWorkspaceGeneralSetting({ ...workspaceGeneralSetting, additionalStyle: value });
  };

  const handleSaveAdditionalStyle = async () => {
    try {
      await workspaceSettingServiceClient.setWorkspaceSetting({
        setting: {
          name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.GENERAL}`,
          generalSetting: workspaceGeneralSetting,
        },
      });
    } catch (error: any) {
      toast.error(error.response.data.message);
      console.error(error);
      return;
    }
    toast.success(t("message.update-succeed"));
  };

  const handleAdditionalScriptChanged = (value: string) => {
    setWorkspaceGeneralSetting({ ...workspaceGeneralSetting, additionalScript: value });
  };

  const handleSaveAdditionalScript = async () => {
    try {
      await workspaceSettingServiceClient.setWorkspaceSetting({
        setting: {
          name: `${WorkspaceSettingPrefix}${WorkspaceSettingKey.GENERAL}`,
          generalSetting: workspaceGeneralSetting,
        },
      });
    } catch (error: any) {
      toast.error(error.response.data.message);
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
        <Button onClick={handleUpdateCustomizedProfileButtonClick}>{t("common.edit")}</Button>
      </div>
      <p className="font-medium text-gray-700 dark:text-gray-500">General</p>
      <div className="w-full flex flex-row justify-between items-center">
        <span className="mr-1">{t("setting.system-section.allow-user-signup")}</span>
        <Switch checked={!workspaceGeneralSetting.disallowSignup} onChange={(event) => handleAllowSignUpChanged(event.target.checked)} />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span className="mr-1">{t("setting.system-section.disable-password-login")}</span>
        <Switch
          checked={workspaceGeneralSetting.disallowPasswordLogin}
          onChange={(event) => handleDisablePasswordLoginChanged(event.target.checked)}
        />
      </div>
      <div className="space-y-2 border rounded-md py-2 px-3 dark:border-zinc-700">
        <div className="w-full flex flex-row justify-between items-center">
          <span>{t("setting.system-section.additional-style")}</span>
          <Button variant="outlined" color="neutral" onClick={handleSaveAdditionalStyle}>
            {t("common.save")}
          </Button>
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
          <Button variant="outlined" color="neutral" onClick={handleSaveAdditionalScript}>
            {t("common.save")}
          </Button>
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
      </div>
    </div>
  );
};

export default WorkspaceSection;
