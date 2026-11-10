import { create } from "@bufbuild/protobuf";
import { Button, Dialog, Field, Input, Textarea } from "@usememos/ui";
import { useState } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { handleError } from "@/lib/error";
import { buildInstanceSettingName } from "@/lib/resource-names";
import { showErrorToast, toast } from "@/lib/toast";
import {
  InstanceSetting_GeneralSetting_CustomProfile,
  InstanceSetting_GeneralSetting_CustomProfileSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/instance_service_pb";

import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function UpdateCustomizedProfileDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslate();
  const fieldErrors = useFieldErrors<"title">();
  const { generalSetting: instanceGeneralSetting, updateSetting } = useInstance();
  const [customProfile, setCustomProfile] = useState<InstanceSetting_GeneralSetting_CustomProfile>(
    create(InstanceSetting_GeneralSetting_CustomProfileSchema, instanceGeneralSetting.customProfile || {}),
  );

  const [isLoading, setIsLoading] = useState(false);

  const setPartialState = (partialState: Partial<InstanceSetting_GeneralSetting_CustomProfile>) => {
    setCustomProfile((state) => ({
      ...state,
      ...partialState,
    }));
  };

  const handleNameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    fieldErrors.clear("title");
    setPartialState({
      title: e.target.value as string,
    });
  };

  const handleLogoUrlChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      logoUrl: e.target.value as string,
    });
  };

  const handleDescriptionChanged = (e: { target: { value: string } }) => {
    setPartialState({
      description: e.target.value as string,
    });
  };

  const handleRestoreButtonClick = () => {
    setPartialState({
      title: "Memos",
      logoUrl: "",
      description: "",
    });
  };

  const handleCloseButtonClick = () => {
    onOpenChange(false);
  };

  const handleSaveButtonClick = async () => {
    if (customProfile.title === "") {
      fieldErrors.set("title", "Title cannot be empty.");
      return;
    }

    setIsLoading(true);
    try {
      await updateSetting(
        create(InstanceSettingSchema, {
          name: buildInstanceSettingName(InstanceSetting_Key.GENERAL),
          value: {
            case: "generalSetting",
            value: {
              ...instanceGeneralSetting,
              customProfile: customProfile,
            },
          },
        }),
      );
      toast.add({ title: t("message.update-succeed"), type: "success" });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      handleError(error, showErrorToast, {
        context: "Update customized profile",
        fallbackMessage: t("error.update-profile-failed"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")} style={{ "--mu-dialog-width": "42rem" } as React.CSSProperties}>
        <Dialog.Title>{t("setting.system.customize-server.title")}</Dialog.Title>
        <Dialog.Description>{t("setting.system.customize-server.dialog-description")}</Dialog.Description>

        <div className="grid gap-4">
          <Field.Root invalid={!!fieldErrors.errors.title}>
            <Field.Label>{t("setting.system.server-name")}</Field.Label>
            <Input id="server-name" type="text" value={customProfile.title} onChange={handleNameChanged} />
            {fieldErrors.errors.title && <Field.Error match>{fieldErrors.errors.title}</Field.Error>}
          </Field.Root>

          <Field.Root>
            <Field.Label>{t("setting.system.customize-server.icon-url")}</Field.Label>
            <Input id="icon-url" type="text" value={customProfile.logoUrl} onChange={handleLogoUrlChanged} />
          </Field.Root>

          <Field.Root>
            <Field.Label>{t("setting.system.customize-server.description")}</Field.Label>
            <Textarea id="description" rows={3} value={customProfile.description} onChange={handleDescriptionChanged} />
          </Field.Root>
        </div>

        <Dialog.Footer className="flex-col sm:flex-row sm:justify-between gap-2">
          <Button variant="neutral" onClick={handleRestoreButtonClick} disabled={isLoading} className="sm:mr-auto">
            {t("common.restore")}
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={handleCloseButtonClick} disabled={isLoading} className="flex-1 sm:flex-initial">
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={handleSaveButtonClick} disabled={isLoading} className="flex-1 sm:flex-initial">
              {isLoading ? "Saving..." : t("common.save")}
            </Button>
          </div>
        </Dialog.Footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

export default UpdateCustomizedProfileDialog;
