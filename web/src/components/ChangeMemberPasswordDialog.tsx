import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userStore } from "@/store";
import { User } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  onSuccess?: () => void;
}

function ChangeMemberPasswordDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const t = useTranslate();
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");

  const handleCloseBtnClick = () => {
    onOpenChange(false);
  };

  const handleNewPasswordChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setNewPassword(text);
  };

  const handleNewPasswordAgainChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setNewPasswordAgain(text);
  };

  const handleSaveBtnClick = async () => {
    if (!user) return;

    if (newPassword === "" || newPasswordAgain === "") {
      toast.error(t("message.fill-all"));
      return;
    }

    if (newPassword !== newPasswordAgain) {
      toast.error(t("message.new-password-not-match"));
      setNewPasswordAgain("");
      return;
    }

    try {
      await userStore.updateUser(
        {
          name: user.name,
          password: newPassword,
        },
        ["password"],
      );
      toast(t("message.password-changed"));
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("setting.account-section.change-password")} ({user.displayName})
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="newPassword">{t("auth.new-password")}</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder={t("auth.new-password")}
              value={newPassword}
              onChange={handleNewPasswordChanged}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPasswordAgain">{t("auth.repeat-new-password")}</Label>
            <Input
              id="newPasswordAgain"
              type="password"
              placeholder={t("auth.repeat-new-password")}
              value={newPasswordAgain}
              onChange={handleNewPasswordAgainChanged}
            />
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

export default ChangeMemberPasswordDialog;
