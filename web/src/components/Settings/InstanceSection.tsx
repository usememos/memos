import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { identityProviderServiceClient } from "@/connect";
import { useInstance } from "@/contexts/InstanceContext";
import useDialog from "@/hooks/useDialog";
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
import { SettingCodeEditor, SettingList, SettingListItem } from "./SettingList";
import SettingSection from "./SettingSection";
import useInstanceSettingUpdater, { buildInstanceSettingName } from "./useInstanceSettingUpdater";

const InstanceSection = () => {
  const t = useTranslate();
  const customizeDialog = useDialog();
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { generalSetting: originalSetting, profile } = useInstance();
  const [instanceGeneralSetting, setInstanceGeneralSetting] = useState<InstanceSetting_GeneralSetting>(originalSetting);
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);

  useEffect(() => {
    setInstanceGeneralSetting(originalSetting);
  }, [originalSetting]);

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
    await saveInstanceSetting({
      key: InstanceSetting_Key.GENERAL,
      setting: create(InstanceSettingSchema, {
        name: buildInstanceSettingName(InstanceSetting_Key.GENERAL),
        value: {
          case: "generalSetting",
          value: instanceGeneralSetting,
        },
      }),
      errorContext: "Update general settings",
    });
  };

  return (
    <SettingSection title={t("setting.system.label")}>
      <SettingGroup title={t("common.basic")} description={t("setting.system.basic-description")}>
        <SettingList>
          <SettingListItem label={t("setting.system.server-name")} description={instanceGeneralSetting.customProfile?.title || "Memos"}>
            <Button variant="outline" onClick={customizeDialog.open}>
              {t("common.edit")}
            </Button>
          </SettingListItem>
        </SettingList>
      </SettingGroup>

      <SettingGroup title={t("setting.system.custom-code-title")} description={t("setting.system.custom-code-description")} showSeparator>
        <SettingCodeEditor
          label={t("setting.system.additional-style")}
          description={t("setting.system.additional-style-description")}
          placeholder={t("setting.system.additional-style-placeholder")}
          value={instanceGeneralSetting.additionalStyle}
          onChange={(additionalStyle) => updatePartialSetting({ additionalStyle })}
        />

        <SettingCodeEditor
          label={t("setting.system.additional-script")}
          description={t("setting.system.additional-script-description")}
          placeholder={t("setting.system.additional-script-placeholder")}
          value={instanceGeneralSetting.additionalScript}
          onChange={(additionalScript) => updatePartialSetting({ additionalScript })}
        />
      </SettingGroup>

      <SettingGroup title={t("setting.instance.access-title")} description={t("setting.instance.access-description")} showSeparator>
        <SettingList>
          <SettingListItem
            label={t("setting.instance.disallow-user-registration")}
            description={t("setting.instance.disallow-user-registration-description")}
          >
            <Switch
              disabled={profile.demo}
              checked={instanceGeneralSetting.disallowUserRegistration}
              onCheckedChange={(checked) => updatePartialSetting({ disallowUserRegistration: checked })}
            />
          </SettingListItem>

          <SettingListItem
            label={t("setting.instance.disallow-password-auth")}
            description={t("setting.instance.disallow-password-auth-description")}
          >
            <Switch
              disabled={profile.demo || (identityProviderList.length === 0 && !instanceGeneralSetting.disallowPasswordAuth)}
              checked={instanceGeneralSetting.disallowPasswordAuth}
              onCheckedChange={(checked) => updatePartialSetting({ disallowPasswordAuth: checked })}
            />
          </SettingListItem>

          <SettingListItem
            label={t("setting.instance.disallow-change-username")}
            description={t("setting.instance.disallow-change-username-description")}
          >
            <Switch
              checked={instanceGeneralSetting.disallowChangeUsername}
              onCheckedChange={(checked) => updatePartialSetting({ disallowChangeUsername: checked })}
            />
          </SettingListItem>

          <SettingListItem
            label={t("setting.instance.disallow-change-nickname")}
            description={t("setting.instance.disallow-change-nickname-description")}
          >
            <Switch
              checked={instanceGeneralSetting.disallowChangeNickname}
              onCheckedChange={(checked) => updatePartialSetting({ disallowChangeNickname: checked })}
            />
          </SettingListItem>

          <SettingListItem label={t("setting.instance.week-start-day")} description={t("setting.instance.week-start-day-description")}>
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
          </SettingListItem>
        </SettingList>
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
