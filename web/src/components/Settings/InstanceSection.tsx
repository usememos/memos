import { isEqual } from "lodash-es";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { identityProviderServiceClient } from "@/grpcweb";
import useDialog from "@/hooks/useDialog";
import { instanceStore } from "@/store";
import { instanceSettingNamePrefix } from "@/store/common";
import { IdentityProvider } from "@/types/proto/api/v1/idp_service";
import { InstanceSetting_GeneralSetting, InstanceSetting_Key } from "@/types/proto/api/v1/instance_service";
import { useTranslate } from "@/utils/i18n";
import ThemeSelect from "../ThemeSelect";
import UpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const InstanceSection = observer(() => {
  const t = useTranslate();
  const customizeDialog = useDialog();
  const originalSetting = InstanceSetting_GeneralSetting.fromPartial(
    instanceStore.getInstanceSettingByKey(InstanceSetting_Key.GENERAL)?.generalSetting || {},
  );
  const [instanceGeneralSetting, setInstanceGeneralSetting] = useState<InstanceSetting_GeneralSetting>(originalSetting);
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);

  useEffect(() => {
    setInstanceGeneralSetting({ ...instanceGeneralSetting, customProfile: originalSetting.customProfile });
  }, [instanceStore.getInstanceSettingByKey(InstanceSetting_Key.GENERAL)]);

  const handleUpdateCustomizedProfileButtonClick = () => {
    customizeDialog.open();
  };

  const updatePartialSetting = (partial: Partial<InstanceSetting_GeneralSetting>) => {
    setInstanceGeneralSetting(
      InstanceSetting_GeneralSetting.fromPartial({
        ...instanceGeneralSetting,
        ...partial,
      }),
    );
  };

  const handleSaveGeneralSetting = async () => {
    try {
      await instanceStore.upsertInstanceSetting({
        name: `${instanceSettingNamePrefix}${InstanceSetting_Key.GENERAL}`,
        generalSetting: instanceGeneralSetting,
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
    <SettingSection>
      <SettingGroup title={t("common.basic")}>
        <SettingRow label={t("setting.system-section.server-name")} description={instanceGeneralSetting.customProfile?.title || "Memos"}>
          <Button variant="outline" onClick={handleUpdateCustomizedProfileButtonClick}>
            {t("common.edit")}
          </Button>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("setting.system-section.title")} showSeparator>
        <SettingRow label="Theme">
          <ThemeSelect
            value={instanceGeneralSetting.theme || "default"}
            onValueChange={(value: string) => updatePartialSetting({ theme: value })}
            className="min-w-fit"
          />
        </SettingRow>

        <SettingRow label={t("setting.system-section.additional-style")} vertical>
          <Textarea
            className="font-mono w-full"
            rows={3}
            placeholder={t("setting.system-section.additional-style-placeholder")}
            value={instanceGeneralSetting.additionalStyle}
            onChange={(event) => updatePartialSetting({ additionalStyle: event.target.value })}
          />
        </SettingRow>

        <SettingRow label={t("setting.system-section.additional-script")} vertical>
          <Textarea
            className="font-mono w-full"
            rows={3}
            placeholder={t("setting.system-section.additional-script-placeholder")}
            value={instanceGeneralSetting.additionalScript}
            onChange={(event) => updatePartialSetting({ additionalScript: event.target.value })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("setting.instance-section.disallow-user-registration")} showSeparator>
        <SettingRow label={t("setting.instance-section.disallow-user-registration")}>
          <Switch
            disabled={instanceStore.state.profile.mode === "demo"}
            checked={instanceGeneralSetting.disallowUserRegistration}
            onCheckedChange={(checked) => updatePartialSetting({ disallowUserRegistration: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.instance-section.disallow-password-auth")}>
          <Switch
            disabled={
              instanceStore.state.profile.mode === "demo" ||
              (identityProviderList.length === 0 && !instanceGeneralSetting.disallowPasswordAuth)
            }
            checked={instanceGeneralSetting.disallowPasswordAuth}
            onCheckedChange={(checked) => updatePartialSetting({ disallowPasswordAuth: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.instance-section.disallow-change-username")}>
          <Switch
            checked={instanceGeneralSetting.disallowChangeUsername}
            onCheckedChange={(checked) => updatePartialSetting({ disallowChangeUsername: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.instance-section.disallow-change-nickname")}>
          <Switch
            checked={instanceGeneralSetting.disallowChangeNickname}
            onCheckedChange={(checked) => updatePartialSetting({ disallowChangeNickname: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.instance-section.week-start-day")}>
          <Select
            value={instanceGeneralSetting.weekStartDayOffset.toString()}
            onValueChange={(value) => {
              updatePartialSetting({ weekStartDayOffset: parseInt(value) || 0 });
            }}
          >
            <SelectTrigger className="min-w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-1">{t("setting.instance-section.saturday")}</SelectItem>
              <SelectItem value="0">{t("setting.instance-section.sunday")}</SelectItem>
              <SelectItem value="1">{t("setting.instance-section.monday")}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button disabled={isEqual(instanceGeneralSetting, originalSetting)} onClick={handleSaveGeneralSetting}>
          {t("common.save")}
        </Button>
      </div>

      <UpdateCustomizedProfileDialog
        open={customizeDialog.isOpen}
        onOpenChange={customizeDialog.setOpen}
        onSuccess={() => {
          // Refresh instance settings if needed
          toast.success("Profile updated successfully!");
        }}
      />
    </SettingSection>
  );
});

export default InstanceSection;
