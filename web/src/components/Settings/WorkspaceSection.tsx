import { isEqual } from "lodash-es";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { identityProviderServiceClient } from "@/grpcweb";
import useDialog from "@/hooks/useDialog";
import { workspaceStore } from "@/store";
import { workspaceSettingNamePrefix } from "@/store/common";
import { IdentityProvider } from "@/types/proto/api/v1/idp_service";
import { WorkspaceSetting_GeneralSetting, WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import { useTranslate } from "@/utils/i18n";
import ThemeSelect from "../ThemeSelect";
import UpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";

const WorkspaceSection = observer(() => {
  const t = useTranslate();
  const customizeDialog = useDialog();
  const originalSetting = WorkspaceSetting_GeneralSetting.fromPartial(
    workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)?.generalSetting || {},
  );
  const [workspaceGeneralSetting, setWorkspaceGeneralSetting] = useState<WorkspaceSetting_GeneralSetting>(originalSetting);
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);

  useEffect(() => {
    setWorkspaceGeneralSetting({ ...workspaceGeneralSetting, customProfile: originalSetting.customProfile });
  }, [workspaceStore.getWorkspaceSettingByKey(WorkspaceSetting_Key.GENERAL)]);

  const handleUpdateCustomizedProfileButtonClick = () => {
    customizeDialog.open();
  };

  const updatePartialSetting = (partial: Partial<WorkspaceSetting_GeneralSetting>) => {
    setWorkspaceGeneralSetting(
      WorkspaceSetting_GeneralSetting.fromPartial({
        ...workspaceGeneralSetting,
        ...partial,
      }),
    );
  };

  const handleSaveGeneralSetting = async () => {
    try {
      await workspaceStore.upsertWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.GENERAL}`,
        generalSetting: workspaceGeneralSetting,
      });
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
      return;
    }
    toast.success(t("message.update-succeed"));
  };

  useEffect(() => {
    fetchIdentityProviderList();
  }, []);

  const fetchIdentityProviderList = async () => {
    const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
    setIdentityProviderList(identityProviders);
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-foreground">{t("common.basic")}</p>
      <div className="w-full flex flex-row justify-between items-center">
        <div>
          {t("setting.system-section.server-name")}:{" "}
          <span className="font-mono font-bold">{workspaceGeneralSetting.customProfile?.title || "Memos"}</span>
        </div>
        <Button variant="outline" onClick={handleUpdateCustomizedProfileButtonClick}>
          {t("common.edit")}
        </Button>
      </div>
      <Separator />
      <p className="font-medium text-foreground">{t("setting.system-section.title")}</p>
      <div className="w-full flex flex-row justify-between items-center">
        <span>Theme</span>
        <ThemeSelect
          value={workspaceGeneralSetting.theme || "default"}
          onValueChange={(value: string) => updatePartialSetting({ theme: value })}
          className="min-w-fit"
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.additional-style")}</span>
      </div>
      <Textarea
        className="font-mono w-full"
        rows={3}
        placeholder={t("setting.system-section.additional-style-placeholder")}
        value={workspaceGeneralSetting.additionalStyle}
        onChange={(event) => updatePartialSetting({ additionalStyle: event.target.value })}
      />
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.additional-script")}</span>
      </div>
      <Textarea
        className="font-mono w-full"
        rows={3}
        placeholder={t("setting.system-section.additional-script-placeholder")}
        value={workspaceGeneralSetting.additionalScript}
        onChange={(event) => updatePartialSetting({ additionalScript: event.target.value })}
      />
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.workspace-section.disallow-user-registration")}</span>
        <Switch
          disabled={workspaceStore.state.profile.mode === "demo"}
          checked={workspaceGeneralSetting.disallowUserRegistration}
          onCheckedChange={(checked) => updatePartialSetting({ disallowUserRegistration: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.workspace-section.disallow-password-auth")}</span>
        <Switch
          disabled={
            workspaceStore.state.profile.mode === "demo" ||
            (identityProviderList.length === 0 && !workspaceGeneralSetting.disallowPasswordAuth)
          }
          checked={workspaceGeneralSetting.disallowPasswordAuth}
          onCheckedChange={(checked) => updatePartialSetting({ disallowPasswordAuth: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.workspace-section.disallow-change-username")}</span>
        <Switch
          checked={workspaceGeneralSetting.disallowChangeUsername}
          onCheckedChange={(checked) => updatePartialSetting({ disallowChangeUsername: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.workspace-section.disallow-change-nickname")}</span>
        <Switch
          checked={workspaceGeneralSetting.disallowChangeNickname}
          onCheckedChange={(checked) => updatePartialSetting({ disallowChangeNickname: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span className="truncate">{t("setting.workspace-section.week-start-day")}</span>
        <Select
          value={workspaceGeneralSetting.weekStartDayOffset.toString()}
          onValueChange={(value) => {
            updatePartialSetting({ weekStartDayOffset: parseInt(value) || 0 });
          }}
        >
          <SelectTrigger className="min-w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-1">{t("setting.workspace-section.saturday")}</SelectItem>
            <SelectItem value="0">{t("setting.workspace-section.sunday")}</SelectItem>
            <SelectItem value="1">{t("setting.workspace-section.monday")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-2 w-full flex justify-end">
        <Button disabled={isEqual(workspaceGeneralSetting, originalSetting)} onClick={handleSaveGeneralSetting}>
          {t("common.save")}
        </Button>
      </div>

      <UpdateCustomizedProfileDialog
        open={customizeDialog.isOpen}
        onOpenChange={customizeDialog.setOpen}
        onSuccess={() => {
          // Refresh workspace settings if needed
          toast.success("Profile updated successfully!");
        }}
      />
    </div>
  );
});

export default WorkspaceSection;
