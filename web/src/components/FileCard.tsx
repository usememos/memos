import dayjs from "dayjs";
import { ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../components/Icon";
import { useResourceStore } from "../store/module";

import { showCommonDialog } from "../components/Dialog/CommonDialog";
import showChangeResourceFilenameDialog from "../components/ChangeResourceFilenameDialog";

import "../less/file-card.less";

interface FileProps {
  resouce: Resource;
  select: any;
  unselect: any;
}

function getFileCover(filename: string): ReactElement {
  switch (filename.split(".").pop()) {
    case "png":
      return <Icon.FileImage className="icon-cover" />;
    case "jpge":
      return <Icon.FileImage className="icon-cover" />;
    case "docx":
      return <Icon.FileText className="icon-cover" />;
    case "pdf":
      return <Icon.FileType2 className="icon-cover" />;
    case "doc":
      return <Icon.FileText className="icon-cover" />;
    default:
      return <Icon.FileImage className="icon-cover" />;
  }
}

const FileCard = ({ resouce, select, unselect }: FileProps) => {
  const locale = "en";

  const [beSelect, setBeSelect] = useState(false);
  const resourceStore = useResourceStore();
  const cover = getFileCover(resouce.filename);
  const { t } = useTranslation();

  const handleRenameBtnClick = (resource: Resource) => {
    showChangeResourceFilenameDialog(resource.id, resource.filename);
  };

  const handleDeleteResourceBtnClick = (resource: Resource) => {
    let warningText = t("resources.warning-text");
    if (resource.linkedMemoAmount > 0) {
      warningText = warningText + `\n${t("resources.linked-amount")}: ${resource.linkedMemoAmount}`;
    }

    showCommonDialog({
      title: t("resources.delete-resource"),
      content: warningText,
      style: "warning",
      dialogName: "delete-resource-dialog",
      onConfirm: async () => {
        await resourceStore.deleteResourceById(resource.id);
      },
    });
  };

  return (
    <div className="resource-card">
      <div className="btns-container">
        <div
          onClick={() => {
            if (beSelect) {
              unselect();
            } else {
              select();
            }
            setBeSelect(!beSelect);
          }}
        >
          {beSelect ? <Icon.CheckCircle2 className="resource-checkbox-selected" /> : <Icon.Circle className="resource-checkbox" />}
        </div>

        <span className="btn more-action-btn">
          <Icon.MoreHorizontal className="icon-img" />
        </span>
        <div className="more-action-btns-wrapper">
          <div className="more-action-btns-container">
            <span
              className="btn"
              onClick={() => {
                handleRenameBtnClick(resouce);
              }}
            >
              <span className="tip-text">{t("resources.rename")}</span>
            </span>
            <span
              className="btn delete-btn"
              onClick={() => {
                handleDeleteResourceBtnClick(resouce);
              }}
            >
              <span className="tip-text">{t("common.delete")}</span>
            </span>
          </div>
        </div>
      </div>
      {cover}
      <div>
        <div className="resource-title">{resouce.filename}</div>
        <div className="resource-time">{dayjs(resouce.createdTs).locale(locale).format("YYYY/MM/DD HH:mm:ss")}</div>
      </div>
    </div>
  );
};

export default FileCard;
