import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { userStore } from "@/store/v2";
import { User } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  user: User;
}

const ChangeMemberPasswordDialog: React.FC<Props> = (props: Props) => {
  const { user, destroy } = props;
  const t = useTranslate();
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");

  useEffect(() => {
    // do nth
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
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
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
  };

  return (
    <div className="max-w-full shadow flex flex-col justify-start items-start bg-white dark:bg-zinc-800 dark:text-gray-300 p-4 rounded-lg">
      <div className="flex flex-row justify-between items-center mb-4 gap-2 w-full">
        <p>
          {t("setting.account-section.change-password")} ({user.displayName})
        </p>
        <Button variant="ghost" onClick={handleCloseBtnClick}>
          <XIcon className="w-5 h-auto" />
        </Button>
      </div>
      <div className="flex flex-col justify-start items-start w-80!">
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
        <div className="flex flex-row justify-end items-center mt-4 w-full gap-x-2">
          <Button variant="ghost" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" onClick={handleSaveBtnClick}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

function showChangeMemberPasswordDialog(user: User) {
  generateDialog(
    {
      className: "change-member-password-dialog",
      dialogName: "change-member-password-dialog",
    },
    ChangeMemberPasswordDialog,
    { user },
  );
}

export default showChangeMemberPasswordDialog;
