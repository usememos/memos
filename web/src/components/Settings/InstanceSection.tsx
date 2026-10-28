import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { identityProviderServiceClient } from "@/connect";
import { useInstance } from "@/contexts/InstanceContext";
import { isFieldManaged, useManagedResource } from "@/hooks/useConfigurationQueries";
import useDialog from "@/hooks/useDialog";
import { IdentityProvider } from "@/types/proto/api/idp_service_pb";
import {
  InstanceAccessMode,
  InstanceSetting_AccessSetting,
  InstanceSetting_AccessSettingSchema,
  InstanceSetting_GeneralSetting,
  InstanceSetting_GeneralSettingSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import UpdateCustomizedProfileDialog from "../UpdateCustomizedProfileDialog";
import ManagedByConfigurationChip from "./ManagedByConfigurationChip";
import SettingGroup from "./SettingGroup";
import { SettingCodeEditor, SettingList, SettingListItem } from "./SettingList";
import SettingSection from "./SettingSection";
import useInstanceSettingUpdater, { buildInstanceSettingName } from "./useInstanceSettingUpdater";

const InstanceSection = () => {
  const t = useTranslate();
  const customizeDialog = useDialog();
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { accessSetting: originalAccessSetting, generalSetting: originalGeneralSetting, profile } = useInstance();
  const [instanceAccessSetting, setInstanceAccessSetting] = useState<InstanceSetting_AccessSetting>(originalAccessSetting);
  const [instanceGeneralSetting, setInstanceGeneralSetting] = useState<InstanceSetting_GeneralSetting>(originalGeneralSetting);
  const [identityProviderList, setIdentityProviderList] = useState<IdentityProvider[]>([]);
  const managedGeneral = useManagedResource(buildInstanceSettingName(InstanceSetting_Key.GENERAL));
  const managedAccess = useManagedResource(buildInstanceSettingName(InstanceSetting_Key.ACCESS));
  const generalLocked = (field: string) => isFieldManaged(managedGeneral, `generalSetting.${field}`);
  const accessLocked = isFieldManaged(managedAccess, "accessSetting.accessMode");
  // A group names its configuration file only when one of its own fields is managed.
  const groupChip = (locked: boolean, resource = managedGeneral) =>
    locked ? <ManagedByConfigurationChip resource={resource} /> : undefined;

  useEffect(() => {
    setInstanceAccessSetting(originalAccessSetting);
  }, [originalAccessSetting]);

  useEffect(() => {
    setInstanceGeneralSetting(originalGeneralSetting);
  }, [originalGeneralSetting]);

  const fetchIdentityProviderList = async () => {
    const { identityProviders } = await identityProviderServiceClient.listIdentityProviders({});
    setIdentityProviderList(identityProviders);
  };

  useEffect(() => {
    fetchIdentityProviderList();
  }, []);

  const weekStartDayOptions = useMemo(
    () => [
      { value: "-1", label: t("setting.instance.saturday") },
      { value: "0", label: t("setting.instance.sunday") },
      { value: "1", label: t("setting.instance.monday") },
    ],
    [t],
  );

  const updatePartialSetting = (partial: Partial<InstanceSetting_GeneralSetting>) => {
    setInstanceGeneralSetting(
      create(InstanceSetting_GeneralSettingSchema, {
        ...instanceGeneralSetting,
        ...partial,
      }),
    );
  };

  const updateAccessMode = (accessMode: InstanceAccessMode) => {
    setInstanceAccessSetting(create(InstanceSetting_AccessSettingSchema, { accessMode }));
  };

  const handleSaveSettings = async () => {
    const generalSettingChanged = !isEqual(instanceGeneralSetting, originalGeneralSetting);
    const accessSettingChanged = !isEqual(instanceAccessSetting, originalAccessSetting);

    if (generalSettingChanged) {
      const generalSettingSaved = await saveInstanceSetting({
        key: InstanceSetting_Key.GENERAL,
        setting: create(InstanceSettingSchema, {
          name: buildInstanceSettingName(InstanceSetting_Key.GENERAL),
          value: {
            case: "generalSetting",
            value: instanceGeneralSetting,
          },
        }),
        errorContext: "Update general settings",
        showSuccessToast: !accessSettingChanged,
      });
      if (!generalSettingSaved) {
        return;
      }
    }

    if (accessSettingChanged) {
      await saveInstanceSetting({
        key: InstanceSetting_Key.ACCESS,
        setting: create(InstanceSettingSchema, {
          name: buildInstanceSettingName(InstanceSetting_Key.ACCESS),
          value: {
            case: "accessSetting",
            value: instanceAccessSetting,
          },
        }),
        errorContext: "Update access settings",
      });
    }
  };

  const hasUnsavedChanges =
    !isEqual(instanceGeneralSetting, originalGeneralSetting) || !isEqual(instanceAccessSetting, originalAccessSetting);

  return (
    <SettingSection title={t("setting.system.label")}>
      <SettingGroup
        title={t("common.basic")}
        description={t("setting.system.basic-description")}
        actions={groupChip(generalLocked("customProfile") || generalLocked("weekStartDayOffset"))}
      >
        <SettingList>
          <SettingListItem label={t("setting.system.server-name")} description={instanceGeneralSetting.customProfile?.title || "Memos"}>
            <Button variant="outline" disabled={generalLocked("customProfile")} onClick={customizeDialog.open}>
              {t("common.edit")}
            </Button>
          </SettingListItem>

          <SettingListItem label={t("setting.instance.week-start-day")} description={t("setting.instance.week-start-day-description")}>
            <Select
              disabled={generalLocked("weekStartDayOffset")}
              value={instanceGeneralSetting.weekStartDayOffset.toString()}
              items={weekStartDayOptions}
              onValueChange={(value) => {
                updatePartialSetting({ weekStartDayOffset: parseInt(value) || 0 });
              }}
            >
              <SelectTrigger className="min-w-fit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekStartDayOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingListItem>
        </SettingList>
      </SettingGroup>

      <SettingGroup
        title={t("setting.instance.access-title")}
        description={t("setting.instance.access-description")}
        showSeparator
        actions={
          groupChip(accessLocked, managedAccess) ??
          groupChip(
            ["disallowUserRegistration", "disallowPasswordAuth", "disallowChangeUsername", "disallowChangeNickname"].some(generalLocked),
          )
        }
      >
        <SettingList>
          <SettingListItem
            label={t("setting.instance.allow-public-access")}
            description={t("setting.instance.allow-public-access-description")}
          >
            <Switch
              disabled={profile.demo || accessLocked}
              checked={instanceAccessSetting.accessMode === InstanceAccessMode.PUBLIC}
              onCheckedChange={(checked) => updateAccessMode(checked ? InstanceAccessMode.PUBLIC : InstanceAccessMode.PRIVATE)}
            />
          </SettingListItem>

          <SettingListItem
            label={t("setting.instance.disallow-user-registration")}
            description={t("setting.instance.disallow-user-registration-description")}
          >
            <Switch
              disabled={profile.demo || generalLocked("disallowUserRegistration")}
              checked={instanceGeneralSetting.disallowUserRegistration}
              onCheckedChange={(checked) => updatePartialSetting({ disallowUserRegistration: checked })}
            />
          </SettingListItem>

          <SettingListItem
            label={t("setting.instance.disallow-password-auth")}
            description={t("setting.instance.disallow-password-auth-description")}
          >
            <Switch
              disabled={
                profile.demo ||
                generalLocked("disallowPasswordAuth") ||
                (identityProviderList.length === 0 && !instanceGeneralSetting.disallowPasswordAuth)
              }
              checked={instanceGeneralSetting.disallowPasswordAuth}
              onCheckedChange={(checked) => updatePartialSetting({ disallowPasswordAuth: checked })}
            />
          </SettingListItem>

          <SettingListItem
            label={t("setting.instance.disallow-change-username")}
            description={t("setting.instance.disallow-change-username-description")}
          >
            <Switch
              disabled={generalLocked("disallowChangeUsername")}
              checked={instanceGeneralSetting.disallowChangeUsername}
              onCheckedChange={(checked) => updatePartialSetting({ disallowChangeUsername: checked })}
            />
          </SettingListItem>

          <SettingListItem
            label={t("setting.instance.disallow-change-nickname")}
            description={t("setting.instance.disallow-change-nickname-description")}
          >
            <Switch
              disabled={generalLocked("disallowChangeNickname")}
              checked={instanceGeneralSetting.disallowChangeNickname}
              onCheckedChange={(checked) => updatePartialSetting({ disallowChangeNickname: checked })}
            />
          </SettingListItem>
        </SettingList>
      </SettingGroup>

      <SettingGroup
        title={t("setting.system.custom-code-title")}
        description={t("setting.system.custom-code-description")}
        showSeparator
        actions={groupChip(generalLocked("additionalStyle") || generalLocked("additionalScript"))}
      >
        <SettingCodeEditor
          label={t("setting.system.additional-style")}
          description={t("setting.system.additional-style-description")}
          placeholder={t("setting.system.additional-style-placeholder")}
          value={instanceGeneralSetting.additionalStyle}
          disabled={generalLocked("additionalStyle")}
          onChange={(additionalStyle) => updatePartialSetting({ additionalStyle })}
        />

        <SettingCodeEditor
          label={t("setting.system.additional-script")}
          description={t("setting.system.additional-script-description")}
          placeholder={t("setting.system.additional-script-placeholder")}
          value={instanceGeneralSetting.additionalScript}
          disabled={generalLocked("additionalScript")}
          onChange={(additionalScript) => updatePartialSetting({ additionalScript })}
        />
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button disabled={!hasUnsavedChanges} onClick={handleSaveSettings}>
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
