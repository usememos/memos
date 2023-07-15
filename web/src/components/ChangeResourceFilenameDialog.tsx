import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslate } from "@/utils/i18n";
import { useResourceStore } from "@/store/module";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import "@/less/change-resource-filename-dialog.less";

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
  const { destroy, resourceId, resourceFilename } = props;
  const t = useTranslate();
  const resourceStore = useResourceStore();
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
      toast.error(t("message.invalid-resource-filename"));
      return;
    }
    try {
      await resourceStore.patchResource({
        id: resourceId,
        filename: filename,
      });
      toast.success(t("message.resource-filename-updated"));
      handleCloseBtnClick();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
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
      dialogName: "change-resource-filename-dialog",
    },
    ChangeResourceFilenameDialog,
    {
      resourceId,
      resourceFilename,
    }
  );
}

export default showChangeResourceFilenameDialog;
