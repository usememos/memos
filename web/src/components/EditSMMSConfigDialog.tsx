import { generateDialog } from "./Dialog";
import Icon from "./Icon";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import toastHelper from "./Toast";
import { useUserStore } from "../store/module";

type Props = DialogProps;

const EditSMMSConfigDialog: React.FC<Props> = ({ destroy }: Props) => {
  const { t } = useTranslation();
  const userStore = useUserStore();
  const { setting } = userStore.state.user as User;
  const [state, setState] = useState<SMMSConfig>(setting.storageConfig?.smmsConfig ?? { token: "" });

  const handleCloseButtonClick = () => {
    destroy();
  };

  const handleTokenChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((state) => {
      return {
        ...state,
        token: e.target.value as string,
      };
    });
  };

  const handleSaveButtonClick = async () => {
    try {
      await userStore.upsertUserSetting("storageConfig", {
        ...setting.storageConfig,
        smmsConfig: state,
      });
    } catch (error) {
      console.error(error);
      return;
    }
    toastHelper.success(t("message.succeed-update-storage-config"));
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">Configs of SM.MS</p>
        <button className="btn close-btn" onClick={handleCloseButtonClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-80">
        <p className="text-sm mb-1">Token</p>
        <input type="text" className="input-text" value={state.token} onChange={handleTokenChanged} />
        <div className="mt-4 w-full flex flex-row-reverse justify-between items-center space-x-2">
          <div className="flex flex-row justify-end items-center">
            <button className="btn-text" onClick={handleCloseButtonClick}>
              {t("common.cancel")}
            </button>
            <button className="btn-primary" onClick={handleSaveButtonClick}>
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

function showEditSMMSConfigDialog() {
  generateDialog(
    {
      className: "edit-smms-config-dialog",
      dialogName: "edit-smms-config-dialog",
    },
    EditSMMSConfigDialog
  );
}

export default showEditSMMSConfigDialog;
