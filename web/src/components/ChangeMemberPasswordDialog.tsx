import { Button, Dialog, Field, Input } from "@usememos/ui";
import { useState } from "react";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { useUpdateUser } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { showErrorToast, toast } from "@/lib/toast";
import { User } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  onSuccess?: () => void;
}

function ChangeMemberPasswordDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const t = useTranslate();
  const fieldErrors = useFieldErrors<"newPassword" | "newPasswordAgain">();
  const { mutateAsync: updateUser } = useUpdateUser();
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");

  const handleCloseBtnClick = () => {
    onOpenChange(false);
  };

  const handleNewPasswordChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    fieldErrors.clear("newPassword");
    const text = e.target.value as string;
    setNewPassword(text);
  };

  const handleNewPasswordAgainChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setNewPasswordAgain(text);
    fieldErrors.clear("newPasswordAgain");
  };

  const handleSaveBtnClick = async () => {
    if (!user) return;

    if (newPassword === "" || newPasswordAgain === "") {
      fieldErrors.set(newPassword === "" ? "newPassword" : "newPasswordAgain", t("message.fill-all"));
      return;
    }

    if (newPassword !== newPasswordAgain) {
      fieldErrors.set("newPasswordAgain", t("message.new-password-not-match"));
      setNewPasswordAgain("");
      return;
    }

    try {
      await updateUser({
        user: {
          name: user.name,
          password: newPassword,
        },
        updateMask: ["password"],
      });
      toast.add({ title: t("message.password-changed") });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      await handleError(error, showErrorToast, {
        context: "Change member password",
      });
    }
  };

  if (!user) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")}>
        <Dialog.Title>
          {t("setting.account.change-password")} ({user.displayName})
        </Dialog.Title>
        <div className="flex flex-col gap-4">
          <Field.Root invalid={!!fieldErrors.errors.newPassword}>
            <Field.Label>{t("auth.new-password")}</Field.Label>
            <Input
              id="newPassword"
              type="password"
              placeholder={t("auth.new-password")}
              value={newPassword}
              onChange={handleNewPasswordChanged}
            />
            {fieldErrors.errors.newPassword && <Field.Error match>{fieldErrors.errors.newPassword}</Field.Error>}
          </Field.Root>
          <Field.Root invalid={!!fieldErrors.errors.newPasswordAgain}>
            <Field.Label>{t("auth.repeat-new-password")}</Field.Label>
            <Input
              id="newPasswordAgain"
              type="password"
              placeholder={t("auth.repeat-new-password")}
              value={newPasswordAgain}
              onChange={handleNewPasswordAgainChanged}
            />
            {fieldErrors.errors.newPasswordAgain && <Field.Error match>{fieldErrors.errors.newPasswordAgain}</Field.Error>}
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

export default ChangeMemberPasswordDialog;
