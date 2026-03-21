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
    setInstanceGeneralSetting((prev) =>
      create(InstanceSetting_GeneralSettingSchema, {
        ...prev,
        customProfile: originalSetting.customProfile,
      }),
    );
  }, [originalSetting.customProfile]);

  const fetchIdentityProviderList = async () => {
    const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
    setIdentityProviderList(identityProviders);
  };

  useEffect(() => {
    fetchIdentityProviderList();
  }, []);

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

  return (
    <SettingSection title={t("setting.system.label")}>
      <SettingGroup title={t("common.basic")}>
        <SettingRow label={t("setting.system.server-name")} description={instanceGeneralSetting.customProfile?.title || "Memos"}>
          <Button variant="outline" onClick={customizeDialog.open}>
            {t("common.edit")}
          </Button>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("setting.system.title")} showSeparator>
        <SettingRow label={t("setting.system.additional-style")} vertical>
          <Textarea
            className="font-mono w-full"
            rows={3}
            placeholder={t("setting.system.additional-style-placeholder")}
            value={instanceGeneralSetting.additionalStyle}
            onChange={(event) => updatePartialSetting({ additionalStyle: event.target.value })}
          />
        </SettingRow>

        <SettingRow label={t("setting.system.additional-script")} vertical>
          <Textarea
            className="font-mono w-full"
            rows={3}
            placeholder={t("setting.system.additional-script-placeholder")}
            value={instanceGeneralSetting.additionalScript}
            onChange={(event) => updatePartialSetting({ additionalScript: event.target.value })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup showSeparator>
        <SettingRow label={t("setting.instance.disallow-user-registration")}>
          <Switch
            disabled={profile.demo}
            checked={instanceGeneralSetting.disallowUserRegistration}
            onCheckedChange={(checked) => updatePartialSetting({ disallowUserRegistration: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.instance.disallow-password-auth")}>
          <Switch
            disabled={profile.demo || (identityProviderList.length === 0 && !instanceGeneralSetting.disallowPasswordAuth)}
            checked={instanceGeneralSetting.disallowPasswordAuth}
            onCheckedChange={(checked) => updatePartialSetting({ disallowPasswordAuth: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.instance.disallow-change-username")}>
          <Switch
            checked={instanceGeneralSetting.disallowChangeUsername}
            onCheckedChange={(checked) => updatePartialSetting({ disallowChangeUsername: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.instance.disallow-change-nickname")}>
          <Switch
            checked={instanceGeneralSetting.disallowChangeNickname}
            onCheckedChange={(checked) => updatePartialSetting({ disallowChangeNickname: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.instance.week-start-day")}>
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
              <SelectItem value="-1">{t("setting.instance.saturday")}</SelectItem>
              <SelectItem value="0">{t("setting.instance.sunday")}</SelectItem>
              <SelectItem value="1">{t("setting.instance.monday")}</SelectItem>
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
          toast.success(t("message.update-succeed"));
        }}
      />
    </SettingSection>
  );
};

export default InstanceSection;
