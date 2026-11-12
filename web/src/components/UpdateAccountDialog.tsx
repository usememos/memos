import { Code } from "@connectrpc/connect";
import { Button, Dialog, Field, Input, Textarea, Tooltip } from "@usememos/ui";
import { isEqual } from "lodash-es";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { useUpdateUser } from "@/hooks/useUserQueries";
import { convertFileToBase64 } from "@/lib/browser";
import { handleError, hasConnectCode } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
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
  const fieldErrors = useFieldErrors<"avatar" | "username">();
  const currentUser = useCurrentUser();
  const { setCurrentUser } = useAuth();
  const { generalSetting: instanceGeneralSetting } = useInstance();
  const { mutateAsync: updateUser } = useUpdateUser();
  const [state, setState] = useState<State>({
    avatarUrl: currentUser?.avatarUrl ?? "",
    username: currentUser?.username ?? "",
    displayName: currentUser?.displayName ?? "",
    email: currentUser?.email ?? "",
    description: currentUser?.description ?? "",
  });
  const [emailError, setEmailError] = useState<string | undefined>();

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
        fieldErrors.set("avatar", t("setting.account.avatar-too-large"));
        return;
      }
      try {
        const base64 = await convertFileToBase64(image);
        fieldErrors.clear("avatar");
        setPartialState({
          avatarUrl: base64,
        });
      } catch (error) {
        console.error(error);
        fieldErrors.set("avatar", t("setting.account.avatar-unreadable"));
      }
    }
  };

  const handleDisplayNameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      displayName: e.target.value as string,
    });
  };

  const handleUsernameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    fieldErrors.clear("username");
    setPartialState({
      username: e.target.value as string,
    });
  };

  const handleEmailChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailError(undefined);
    setState((state) => {
      return {
        ...state,
        email: e.target.value as string,
      };
    });
  };

  const handleDescriptionChanged = (e: { target: { value: string } }) => {
    setState((state) => {
      return {
        ...state,
        description: e.target.value as string,
      };
    });
  };

  const handleSaveBtnClick = async () => {
    if (state.username === "") {
      fieldErrors.set("username", t("message.fill-all"));
      return;
    }

    try {
      const updateMask = [];
      if (!isEqual(currentUser?.username, state.username)) {
        updateMask.push("username");
      }
      if (!isEqual(currentUser?.displayName, state.displayName)) {
        updateMask.push("display_name");
      }
      if (!isEqual(currentUser?.email, state.email)) {
        updateMask.push("email");
      }
      if (!isEqual(currentUser?.avatarUrl, state.avatarUrl)) {
        updateMask.push("avatar_url");
      }
      if (!isEqual(currentUser?.description, state.description)) {
        updateMask.push("description");
      }
      const updatedUser = await updateUser({
        user: {
          name: currentUser?.name,
          username: state.username,
          displayName: state.displayName,
          email: state.email,
          avatarUrl: state.avatarUrl,
          description: state.description,
        },
        updateMask,
      });
      setCurrentUser(updatedUser);
      toast.add({ title: t("message.update-succeed"), type: "success" });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      if (hasConnectCode(error, Code.AlreadyExists) && error.rawMessage.includes("email")) {
        setEmailError(t("setting.account.email-in-use"));
        return;
      }
      await handleError(error, showErrorToast, {
        context: "Update account",
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")}>
        <Dialog.Title>{t("setting.account.update-information")}</Dialog.Title>
        <div className="flex flex-col gap-4">
          <Field.Root invalid={!!fieldErrors.errors.avatar}>
            <div className="flex flex-row items-center gap-2">
              <span className="mu-label">{t("common.avatar")}</span>
              <label className="relative cursor-pointer hover:opacity-80">
                <UserAvatar className="w-10 h-10" avatarUrl={state.avatarUrl} name={state.displayName || currentUser?.username} />
                <input type="file" accept="image/*" className="absolute invisible w-full h-full inset-0" onChange={handleAvatarChanged} />
              </label>
              {state.avatarUrl && (
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        variant="ghost"
                        size="xs"
                        aria-label={t("common.clear")}
                        icon={<XIcon />}
                        onClick={() => setPartialState({ avatarUrl: "" })}
                      />
                    }
                  />
                  <Tooltip.Popup>{t("common.clear")}</Tooltip.Popup>
                </Tooltip.Root>
              )}
            </div>
            {fieldErrors.errors.avatar && <Field.Error match>{fieldErrors.errors.avatar}</Field.Error>}
          </Field.Root>
          <Field.Root invalid={!!fieldErrors.errors.username}>
            <Field.Label>
              {t("common.username")}
              <span className="mu-body text-mu-ink-muted ml-1">({t("setting.account.username-note")})</span>
            </Field.Label>
            <Input
              id="username"
              value={state.username}
              onChange={handleUsernameChanged}
              disabled={instanceGeneralSetting.disallowChangeUsername}
            />
            {fieldErrors.errors.username && <Field.Error match>{fieldErrors.errors.username}</Field.Error>}
          </Field.Root>
          <Field.Root>
            <Field.Label>
              {t("common.nickname")}
              <span className="mu-body text-mu-ink-muted ml-1">({t("setting.account.nickname-note")})</span>
            </Field.Label>
            <Input
              id="displayName"
              value={state.displayName}
              onChange={handleDisplayNameChanged}
              disabled={instanceGeneralSetting.disallowChangeNickname}
            />
          </Field.Root>
          <Field.Root invalid={!!emailError}>
            <Field.Label>
              {t("common.email")}
              <span className="mu-body text-mu-ink-muted ml-1">({t("setting.account.email-note")})</span>
            </Field.Label>
            <Input id="email" type="email" value={state.email} onChange={handleEmailChanged} />
            {emailError && <Field.Error match>{emailError}</Field.Error>}
          </Field.Root>
          <Field.Root>
            <Field.Label>{t("common.description")}</Field.Label>
            <Textarea id="description" rows={2} value={state.description} onChange={handleDescriptionChanged} />
          </Field.Root>
        </div>
        <Dialog.Footer>
          <Button variant="ghost" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSaveBtnClick}>
            {t("common.save")}
          </Button>
        </Dialog.Footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
}

export default UpdateAccountDialog;
