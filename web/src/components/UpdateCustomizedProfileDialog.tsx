import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workspaceStore } from "@/store";
import { workspaceSettingNamePrefix } from "@/store/common";
import { WorkspaceSetting_GeneralSetting_CustomProfile, WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import { useTranslate } from "@/utils/i18n";
import LocaleSelect from "./LocaleSelect";
import ThemeSelect from "./ThemeSelect";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function UpdateCustomizedProfileDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslate();
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;
  const [customProfile, setCustomProfile] = useState<WorkspaceSetting_GeneralSetting_CustomProfile>(
    WorkspaceSetting_GeneralSetting_CustomProfile.fromPartial(workspaceGeneralSetting.customProfile || {}),
  );

  const [isLoading, setIsLoading] = useState(false);

  const setPartialState = (partialState: Partial<WorkspaceSetting_GeneralSetting_CustomProfile>) => {
    setCustomProfile((state) => ({
      ...state,
      ...partialState,
    }));
  };

  const handleNameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      title: e.target.value as string,
    });
  };

  const handleLogoUrlChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      logoUrl: e.target.value as string,
    });
  };

  const handleDescriptionChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPartialState({
      description: e.target.value as string,
    });
  };

  const handleLocaleSelectChange = (locale: Locale) => {
    setPartialState({
      locale: locale,
    });
  };

  const handleRestoreButtonClick = () => {
    setPartialState({
      title: "Memos",
      logoUrl: "/logo.webp",
      description: "",
      locale: "en",
    });
  };

  const handleCloseButtonClick = () => {
    onOpenChange(false);
  };

  const handleSaveButtonClick = async () => {
    if (customProfile.title === "") {
      toast.error("Title cannot be empty.");
      return;
    }

    setIsLoading(true);
    try {
      await workspaceStore.upsertWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.GENERAL}`,
        generalSetting: {
          ...workspaceGeneralSetting,
          customProfile: customProfile,
        },
      });
      toast.success(t("message.update-succeed"));
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("setting.system-section.customize-server.title")}</DialogTitle>
          <DialogDescription>Customize your workspace appearance and settings.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="server-name">{t("setting.system-section.server-name")}</Label>
            <Input id="server-name" type="text" value={customProfile.title} onChange={handleNameChanged} placeholder="Enter server name" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="icon-url">{t("setting.system-section.customize-server.icon-url")}</Label>
            <Input id="icon-url" type="text" value={customProfile.logoUrl} onChange={handleLogoUrlChanged} placeholder="Enter icon URL" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">{t("setting.system-section.customize-server.description")}</Label>
            <Textarea
              id="description"
              rows={3}
              value={customProfile.description}
              onChange={handleDescriptionChanged}
              placeholder="Enter description"
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("setting.system-section.customize-server.locale")}</Label>
            <LocaleSelect value={customProfile.locale} onChange={handleLocaleSelectChange} />
          </div>

          <div className="grid gap-2">
            <Label>Theme</Label>
            <ThemeSelect />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <Button variant="outline" onClick={handleRestoreButtonClick} disabled={isLoading} className="sm:mr-auto">
            {t("common.restore")}
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={handleCloseButtonClick} disabled={isLoading} className="flex-1 sm:flex-initial">
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveButtonClick} disabled={isLoading} className="flex-1 sm:flex-initial">
              {isLoading ? "Saving..." : t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpdateCustomizedProfileDialog;
