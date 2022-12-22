import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalStore } from "../store/module";
import * as api from "../helpers/api";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
import LocaleSelect from "./LocaleSelect";
import AppearanceSelect from "./AppearanceSelect";

type Props = DialogProps;

const UpdateCustomizedProfileDialog: React.FC<Props> = ({ destroy }: Props) => {
  const { t } = useTranslation();
  const globalStore = useGlobalStore();
  const [state, setState] = useState<CustomizedProfile>(globalStore.state.systemStatus.customizedProfile);

  useEffect(() => {
    // do nth
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleNameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((state) => {
      return {
        ...state,
        name: e.target.value as string,
      };
    });
  };

  const handleIconUrlChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((state) => {
      return {
        ...state,
        iconUrl: e.target.value as string,
      };
    });
  };

  const handleDescriptionChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((state) => {
      return {
        ...state,
        description: e.target.value as string,
      };
    });
  };

  const handleLocaleSelectChange = (locale: Locale) => {
    setState((state) => {
      return {
        ...state,
        locale: locale,
      };
    });
  };

  const handleAppearanceSelectChange = (appearance: Appearance) => {
    setState((state) => {
      return {
        ...state,
        appearance: appearance,
      };
    });
  };

  const handleSaveBtnClick = async () => {
    if (state.name === "" || state.iconUrl === "") {
      toastHelper.error(t("message.fill-all"));
      return;
    }

    try {
      await api.upsertSystemSetting({
        name: "customizedProfile",
        value: JSON.stringify(state),
      });
      await globalStore.fetchSystemStatus();
    } catch (error) {
      console.error(error);
      return;
    }
    toastHelper.success(t("message.succeed-update-customized-profile"));
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("setting.system-section.customize-server.title")}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-80">
        <p className="text-sm mb-1">
          {t("setting.system-section.server-name")}
          <span className="text-sm text-gray-400 ml-1">({t("setting.system-section.customize-server.default")})</span>
        </p>
        <input type="text" className="input-text" value={state.name} onChange={handleNameChanged} />
        <p className="text-sm mb-1 mt-2">{t("setting.system-section.customize-server.icon-url")}</p>
        <input type="text" className="input-text" value={state.iconUrl} onChange={handleIconUrlChanged} />
        <p className="text-sm mb-1 mt-2">Description</p>
        <input type="text" className="input-text" value={state.description} onChange={handleDescriptionChanged} />
        <p className="text-sm mb-1 mt-2">Server locale</p>
        <LocaleSelect className="w-full" value={state.locale} onChange={handleLocaleSelectChange} />
        <p className="text-sm mb-1 mt-2">Server appearance</p>
        <AppearanceSelect className="w-full" value={state.appearance} onChange={handleAppearanceSelectChange} />
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

function showUpdateCustomizedProfileDialog() {
  generateDialog(
    {
      className: "update-customized-profile-dialog",
      dialogName: "update-customized-profile-dialog",
    },
    UpdateCustomizedProfileDialog
  );
}

export default showUpdateCustomizedProfileDialog;
