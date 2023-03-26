import dayjs from "dayjs";
import { useState } from "react";
import Icon from "./Icon";
import ResourceCover from "./ResourceCover";
import "../less/resource-card.less";
import ResourceItemDropdown from "./ResourceItemDropdown";

const ResourceCard = ({
  resource,
  handleCheckClick,
  handleUncheckClick,
  handlePreviewBtnClick,
  handleCopyResourceLinkBtnClick,
  handleRenameBtnClick,
  handleDeleteResourceBtnClick,
}: ResourceItemType) => {
  const [isSelected, setIsSelected] = useState<boolean>(false);

  const handleSelectBtnClick = () => {
    if (isSelected) {
      handleUncheckClick();
    } else {
      handleCheckClick();
    }
    setIsSelected(!isSelected);
  };

  return (
    <div className="resource-card">
      <div className="w-full p-2 flex flex-row justify-between items-center absolute top-0 left-0">
        <div onClick={() => handleSelectBtnClick()}>
          {isSelected ? <Icon.CheckCircle2 className="resource-checkbox !flex" /> : <Icon.Circle className="resource-checkbox" />}
        </div>
        <div className="more-action-btn">
          <ResourceItemDropdown
            resource={resource}
            handleCopyResourceLinkBtnClick={handleCopyResourceLinkBtnClick}
            handleDeleteResourceBtnClick={handleDeleteResourceBtnClick}
            handlePreviewBtnClick={handlePreviewBtnClick}
            handleRenameBtnClick={handleRenameBtnClick}
          />
        </div>
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
