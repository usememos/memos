import { isEqual } from "lodash-es";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { convertFileToBase64 } from "@/helpers/utils";
import useCurrentUser from "@/hooks/useCurrentUser";
import { userStore, workspaceStore } from "@/store";
import { User as UserPb } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import UserAvatar from "./UserAvatar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface State {
  avatarUrl: string;
  username: string;
  displayName: string;
  email: string;
  description: string;
}

function UpdateAccountDialog({ open, onOpenChange, onSuccess }: Props) {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [state, setState] = useState<State>({
    avatarUrl: currentUser.avatarUrl,
    username: currentUser.username,
    displayName: currentUser.displayName,
    email: currentUser.email,
    description: currentUser.description,
  });
  const workspaceGeneralSetting = workspaceStore.state.generalSetting;

  const handleCloseBtnClick = () => {
    onOpenChange(false);
  };

  const setPartialState = (partialState: Partial<State>) => {
    setState((state) => {
      return {
        ...state,
        ...partialState,
      };
    });
  };

  const handleAvatarChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const image = files[0];
      if (image.size > 2 * 1024 * 1024) {
        toast.error("Max file size is 2MB");
        return;
      }
      try {
        const base64 = await convertFileToBase64(image);
        setPartialState({
          avatarUrl: base64,
        });
      } catch (error) {
        console.error(error);
        toast.error(`Failed to convert image to base64`);
      }
    }
  };

  const handleDisplayNameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      displayName: e.target.value as string,
    });
  };

  const handleUsernameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      username: e.target.value as string,
    });
  };

  const handleEmailChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((state) => {
      return {
        ...state,
        email: e.target.value as string,
      };
    });
  };

  const handleDescriptionChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState((state) => {
      return {
        ...state,
        description: e.target.value as string,
      };
    });
  };

  const handleSaveBtnClick = async () => {
    if (state.username === "") {
      toast.error(t("message.fill-all"));
      return;
    }

    try {
      const updateMask = [];
      if (!isEqual(currentUser.username, state.username)) {
        updateMask.push("username");
      }
      if (!isEqual(currentUser.displayName, state.displayName)) {
        updateMask.push("display_name");
      }
      if (!isEqual(currentUser.email, state.email)) {
        updateMask.push("email");
      }
      if (!isEqual(currentUser.avatarUrl, state.avatarUrl)) {
        updateMask.push("avatar_url");
      }
      if (!isEqual(currentUser.description, state.description)) {
        updateMask.push("description");
      }
      await userStore.updateUser(
        UserPb.fromPartial({
          name: currentUser.name,
          username: state.username,
          displayName: state.displayName,
          email: state.email,
          avatarUrl: state.avatarUrl,
          description: state.description,
        }),
        updateMask,
      );
      toast.success(t("message.update-succeed"));
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("setting.account-section.update-information")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-center gap-2">
            <Label>{t("common.avatar")}</Label>
            <label className="relative cursor-pointer hover:opacity-80">
              <UserAvatar className="w-10 h-10" avatarUrl={state.avatarUrl} />
              <input type="file" accept="image/*" className="absolute invisible w-full h-full inset-0" onChange={handleAvatarChanged} />
            </label>
            {state.avatarUrl && (
              <XIcon
                className="w-4 h-auto cursor-pointer opacity-60 hover:opacity-80"
                onClick={() =>
                  setPartialState({
                    avatarUrl: "",
                  })
                }
              />
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">
              {t("common.username")}
              <span className="text-sm text-muted-foreground ml-1">({t("setting.account-section.username-note")})</span>
            </Label>
            <Input
              id="username"
              value={state.username}
              onChange={handleUsernameChanged}
              disabled={workspaceGeneralSetting.disallowChangeUsername}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="displayName">
              {t("common.nickname")}
              <span className="text-sm text-muted-foreground ml-1">({t("setting.account-section.nickname-note")})</span>
            </Label>
            <Input
              id="displayName"
              value={state.displayName}
              onChange={handleDisplayNameChanged}
              disabled={workspaceGeneralSetting.disallowChangeNickname}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">
              {t("common.email")}
              <span className="text-sm text-muted-foreground ml-1">({t("setting.account-section.email-note")})</span>
            </Label>
            <Input id="email" type="email" value={state.email} onChange={handleEmailChanged} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">{t("common.description")}</Label>
            <Textarea id="description" rows={2} value={state.description} onChange={handleDescriptionChanged} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSaveBtnClick}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpdateAccountDialog;
