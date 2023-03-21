import { useState } from "react";
import ResourceItemDropdown from "./ResourceItemDropdown";

const ResourceItem = ({
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
    <div key={resource.id} className="px-2 py-2 w-full grid grid-cols-7">
      <span className="w-full m-auto truncate col-span-1  justify-center">
        <input type="checkbox" onClick={handleSelectBtnClick}></input>
      </span>
      <span className="w-full m-auto truncate text-base pr-2 last:pr-0 col-span-1">{resource.id}</span>
      <span className="w-full m-auto truncate text-base pr-2 last:pr-0 col-span-4" onClick={() => handleRenameBtnClick(resource)}>
        {resource.filename}
      </span>
      <div className="w-full flex flex-row justify-between items-center mb-2">
        <ResourceItemDropdown
          resource={resource}
          handleCopyResourceLinkBtnClick={handleCopyResourceLinkBtnClick}
          handleDeleteResourceBtnClick={handleDeleteResourceBtnClick}
          handlePreviewBtnClick={handlePreviewBtnClick}
          handleRenameBtnClick={handleRenameBtnClick}
        />
      </div>
    </div>
  );
};

export default ResourceItem;
