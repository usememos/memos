import { Button, IconButton, Input } from "@mui/joy";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useCommonContext } from "@/layouts/CommonContextProvider";
import { useUserStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";

type Props = DialogProps;

const ChangePasswordDialog: React.FC<Props> = ({ destroy }: Props) => {
  const t = useTranslate();
  const commonContext = useCommonContext();
  const currentUser = useCurrentUser();
  const userStore = useUserStore();
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");

  useEffect(() => {
    if (commonContext.profile.mode === "demo") {
      toast.error("Demo mode does not support this operation.");
      destroy();
    }
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleNewPasswordChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value);
  };

  const handleNewPasswordAgainChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPasswordAgain(e.target.value);
  };

  const handleSaveBtnClick = async () => {
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
          name: currentUser.name,
          password: newPassword,
        },
        ["password"],
      );
      toast.success(t("message.password-changed"));
      handleCloseBtnClick();
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
    }
  };

  return (
    <>
      <div className="dialog-header-container !w-64">
        <p className="title-text">{t("setting.account-section.change-password")}</p>
        <IconButton size="sm" onClick={handleCloseBtnClick}>
          <XIcon className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="dialog-content-container">
        <p className="text-sm mb-1">{t("auth.new-password")}</p>
        <Input
          className="w-full"
          type="password"
          placeholder={t("auth.new-password")}
          value={newPassword}
          onChange={handleNewPasswordChanged}
        />
        <p className="text-sm mb-1 mt-2">{t("auth.repeat-new-password")}</p>
        <Input
          className="w-full"
          type="password"
          placeholder={t("auth.repeat-new-password")}
          value={newPasswordAgain}
          onChange={handleNewPasswordAgainChanged}
        />
        <div className="w-full flex flex-row justify-end items-center pt-4 space-x-2">
          <Button color="neutral" variant="plain" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" onClick={handleSaveBtnClick}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </>
  );
};

function showChangePasswordDialog() {
  generateDialog(
    {
      className: "change-password-dialog",
      dialogName: "change-password-dialog",
    },
    ChangePasswordDialog,
  );
}

export default showChangePasswordDialog;
