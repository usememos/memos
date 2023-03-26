import React from "react";
import { useTranslation } from "react-i18next";
import Dropdown from "./base/Dropdown";
import Icon from "./Icon";

interface ResourceItemDropdown {
  resource: Resource;
  handleRenameBtnClick: (resource: Resource) => void;
  handleDeleteResourceBtnClick: (resource: Resource) => void;
  handlePreviewBtnClick: (resource: Resource) => void;
  handleCopyResourceLinkBtnClick: (resource: Resource) => void;
}

const ResourceItemDropdown = ({
  resource,
  handlePreviewBtnClick,
  handleCopyResourceLinkBtnClick,
  handleRenameBtnClick,
  handleDeleteResourceBtnClick,
}: ResourceItemDropdown) => {
  const { t } = useTranslation();

  return (
    <Dropdown
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
  );
};

export default React.memo(ResourceItemDropdown);
