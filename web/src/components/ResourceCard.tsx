import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";
import Dropdown from "./base/Dropdown";
import ResourceCover from "./ResourceCover";
import "../less/resource-card.less";

const ResourceCard = ({
  resource,
  handlecheckClick,
  handleUncheckClick,
  handlePreviewBtnClick,
  handleCopyResourceLinkBtnClick,
  handleRenameBtnClick,
  handleDeleteResourceBtnClick,
}: ResourceType) => {
  const [isSelected, setIsSelected] = useState<boolean>(false);
  const { t } = useTranslation();

  const handleSelectBtnClick = () => {
    if (isSelected) {
      handleUncheckClick();
    } else {
      handlecheckClick();
    }
    setIsSelected(!isSelected);
  };

  return (
    <div className="resource-card">
      <div className="w-full p-2 flex flex-row justify-between items-center absolute top-0 left-0">
        <div onClick={() => handleSelectBtnClick()}>
          {isSelected ? <Icon.CheckCircle2 className="resource-checkbox !flex" /> : <Icon.Circle className="resource-checkbox" />}
        </div>

        <Dropdown
          className="more-action-btn"
          actionsClassName="!w-28"
          trigger={<Icon.MoreVertical className="w-4 h-auto hover:opacity-80 cursor-pointer" />}
          actions={
            <>
              <button
                className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                onClick={() => handlePreviewBtnClick(resource)}
              >
                {t("resources.preview")}
              </button>
              <button
                className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                onClick={() => handleCopyResourceLinkBtnClick(resource)}
              >
                {t("resources.copy-link")}
              </button>
              <button
                className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                onClick={() => handleRenameBtnClick(resource)}
              >
                {t("resources.rename")}
              </button>
              <button
                className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded text-red-600 hover:bg-gray-100 dark:hover:bg-zinc-600"
                onClick={() => handleDeleteResourceBtnClick(resource)}
              >
                {t("common.delete")}
              </button>
            </>
          }
        />
      </div>
      <div className="w-full flex flex-row justify-center items-center pb-2 pt-4 px-2">
        <ResourceCover resource={resource} />
      </div>
      <div className="w-full flex flex-col justify-start items-center px-1 select-none">
        <div className="w-full text-base text-center text-ellipsis overflow-hidden">{resource.filename}</div>
        <div className="text-xs text-gray-400 text-center">{dayjs(resource.createdTs).locale("en").format("YYYY/MM/DD HH:mm:ss")}</div>
      </div>
    </div>
  );
};

export default ResourceCard;
