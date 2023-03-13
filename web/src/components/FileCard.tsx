import dayjs from "dayjs";
import { ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../components/Icon";

import "../less/file-card.less";

interface FileProps {
  resouce: Resource;
  select: any;
  unselect: any;
  rename: any;
  deleteHandle: any;
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

const FileCard = ({ resouce, select, unselect, rename, deleteHandle }: FileProps) => {
  const locale = "en";

  const [beSelect, setBeSelect] = useState(false);
  const cover = getFileCover(resouce.filename);
  const { t, _ } = useTranslation();

  return (
    <div
      className="resource-card"
      onClick={() => {
        if (beSelect) {
          unselect();
        } else {
          select();
        }

        setBeSelect(!beSelect);
      }}
    >
      <div className="btns-container">
        <span className="btn more-action-btn">
          <Icon.MoreHorizontal className="icon-img" />
        </span>
        <div className="more-action-btns-wrapper">
          <div className="more-action-btns-container">
            <span
              className="btn"
              onClick={() => {
                rename(resouce);
              }}
            >
              {"rename"}
            </span>
            <span
              className="btn"
              onClick={() => {
                deleteHandle(resouce);
              }}
            >
              {"delete"}
            </span>
          </div>
        </div>

        {beSelect ? <Icon.CheckCircle2 className="resource-checkbox-selected" /> : <Icon.Circle className="resource-checkbox" />}
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
