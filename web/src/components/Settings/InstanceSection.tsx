import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { identityProviderServiceClient } from "@/connect";
import { useInstance } from "@/contexts/InstanceContext";
import useDialog from "@/hooks/useDialog";
import { handleError } from "@/lib/error";
import { IdentityProvider } from "@/types/proto/api/v1/idp_service_pb";
import {
  InstanceSetting_GeneralSetting,
  InstanceSetting_GeneralSettingSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import UpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const InstanceSection = () => {
  const t = useTranslate();
  const customizeDialog = useDialog();
  const { generalSetting: originalSetting, profile, updateSetting, fetchSetting } = useInstance();
  const [instanceGeneralSetting, setInstanceGeneralSetting] = useState<InstanceSetting_GeneralSetting>(originalSetting);
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);

  useEffect(() => {
    setInstanceGeneralSetting({ ...instanceGeneralSetting, customProfile: originalSetting.customProfile });
  }, [originalSetting]);

  const handleUpdateCustomizedProfileButtonClick = () => {
    customizeDialog.open();
  };

  const updatePartialSetting = (partial: Partial<InstanceSetting_GeneralSetting>) => {
    setInstanceGeneralSetting(
      create(InstanceSetting_GeneralSettingSchema, {
        ...instanceGeneralSetting,
        ...partial,
      }),
    );
  };

  const handleSaveGeneralSetting = async () => {
    try {
      await updateSetting(
        create(InstanceSettingSchema, {
          name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.GENERAL]}`,
          value: {
            case: "generalSetting",
            value: instanceGeneralSetting,
          },
        }),
      );
      await fetchSetting(InstanceSetting_Key.GENERAL);
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: "Update general settings",
      });
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

      <SettingGroup>
        <SettingRow label={t("setting.instance-section.disallow-user-registration")}>
          <Switch
            disabled={profile.demo}
            checked={instanceGeneralSetting.disallowUserRegistration}
            onCheckedChange={(checked) => updatePartialSetting({ disallowUserRegistration: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.instance-section.disallow-password-auth")}>
          <Switch
            disabled={profile.demo || (identityProviderList.length === 0 && !instanceGeneralSetting.disallowPasswordAuth)}
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
};

export default InstanceSection;
