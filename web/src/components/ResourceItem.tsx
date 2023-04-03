import { Checkbox } from "@mui/joy";
import { useState } from "react";
import ResourceItemDropdown from "./ResourceItemDropdown";

const ResourceItem = ({ resource, handleCheckClick, handleUncheckClick }: ResourceItemType) => {
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
    <div key={resource.id} className="px-2 py-2 w-full grid grid-cols-10">
      <span className="col-span-1 w-full flex justify-center m-auto truncate ">
        <Checkbox checked={isSelected} onChange={handleSelectBtnClick} />
      </span>
      <span className="col-span-2 w-full m-auto truncate text-base pr-2">{resource.id}</span>
      <span className="col-span-6 w-full m-auto truncate text-base pr-2">{resource.filename}</span>
      <div className="col-span-1 w-full flex flex-row justify-end items-center pr-2">
        <ResourceItemDropdown resource={resource} />
      </div>
    </div>
  );
};

export default ResourceItem;
