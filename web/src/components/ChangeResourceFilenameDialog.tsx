import { useState } from "react";
import { useTranslation } from "react-i18next";
import { resourceService } from "../services";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
import "../less/change-resource-filename-dialog.less";

interface Props extends DialogProps {
  resourceId: ResourceId;
  resourceFilename: string;
}

const validateFilename = (filename: string): boolean => {
  if (filename.length === 0 || filename.length >= 128) {
    return false;
  }
  const startReg = /^([+\-.]).*/;
  const illegalReg = /[/@#$%^&*()[\]]/;
  if (startReg.test(filename) || illegalReg.test(filename)) {
    return false;
  }
  return true;
};

const ChangeResourceFilenameDialog: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation();
  const { destroy, resourceId, resourceFilename } = props;
  const [filename, setFilename] = useState<string>(resourceFilename);

  const handleFilenameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextUsername = e.target.value as string;
    setFilename(nextUsername);
  };

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleSaveBtnClick = async () => {
    if (filename === resourceFilename) {
      handleCloseBtnClick();
      return;
    }
    if (!validateFilename(filename)) {
      toastHelper.error(t("message.invalid-resource-filename"));
      return;
    }
    try {
      await resourceService.patchResource({
        id: resourceId,
        filename: filename,
      });
      toastHelper.info(t("message.resource-filename-updated"));
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("message.change-resource-filename")}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <input className="input-text" type="text" value={filename} onChange={handleFilenameChanged} />
        <div className="btns-container">
          <button className="btn-text" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </button>
          <button className="btn-primary" onClick={handleSaveBtnClick}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </>
  );
};

function showChangeResourceFilenameDialog(resourceId: ResourceId, resourceFilename: string) {
  generateDialog(
    {
      className: "change-resource-filename-dialog",
    },
    ChangeResourceFilenameDialog,
    {
      resourceId,
      resourceFilename,
    }
  );
}

export default showChangeResourceFilenameDialog;
