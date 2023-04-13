import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useUserStore } from "@/store/module";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  user: User;
}

const ChangeMemberPasswordDialog: React.FC<Props> = (props: Props) => {
  const { user: propsUser, destroy } = props;
  const { t } = useTranslation();
  const userStore = useUserStore();
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
      await userStore.patchUser({
        id: propsUser.id,
        password: newPassword,
      });
      toast(t("message.password-changed"));
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  return (
    <>
      <div className="dialog-header-container !w-64">
        <p className="title-text">
          {t("setting.account-section.change-password")} ({propsUser.username})
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <p className="text-sm mb-1">{t("auth.new-password")}</p>
        <input
          type="password"
          className="input-text"
          placeholder={t("auth.new-password")}
          value={newPassword}
          onChange={handleNewPasswordChanged}
        />
        <p className="text-sm mb-1 mt-2">{t("auth.repeat-new-password")}</p>
        <input
          type="password"
          className="input-text"
          placeholder={t("auth.repeat-new-password")}
          value={newPasswordAgain}
          onChange={handleNewPasswordAgainChanged}
        />
        <div className="mt-4 w-full flex flex-row justify-end items-center space-x-2">
          <span className="btn-text" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </span>
          <span className="btn-primary" onClick={handleSaveBtnClick}>
            {t("common.save")}
          </span>
        </div>
      </div>
    </>
  );
};

function showChangeMemberPasswordDialog(user: User) {
  generateDialog(
    {
      className: "change-member-password-dialog",
      dialogName: "change-member-password-dialog",
    },
    ChangeMemberPasswordDialog,
    { user }
  );
}

export default showChangeMemberPasswordDialog;
