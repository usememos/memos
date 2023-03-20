import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import { useResourceStore } from "../store/module";
import Icon from "./Icon";
import copy from "copy-to-clipboard";
import { getResourceUrl } from "../utils/resource";
import showPreviewImageDialog from "./PreviewImageDialog";
import Dropdown from "./base/Dropdown";
import ResourceCover from "./ResourceCover";
import { showCommonDialog } from "./Dialog/CommonDialog";
import showChangeResourceFilenameDialog from "./ChangeResourceFilenameDialog";
import "../less/resource-card.less";

interface ResourceProps {
  resource: Resource;
  handlecheckClick: () => void;
  handleUncheckClick: () => void;
}

const ResourceItem = ({ resource, handlecheckClick, handleUncheckClick }: ResourceProps) => {
  const [isSelected, setIsSelected] = useState<boolean>(false);
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;
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

  const handlePreviewBtnClick = (resource: Resource) => {
    const resourceUrl = getResourceUrl(resource);
    if (resource.type.startsWith("image")) {
      showPreviewImageDialog(
        resources.filter((r) => r.type.startsWith("image")).map((r) => getResourceUrl(r)),
        resources.findIndex((r) => r.id === resource.id)
      );
    } else {
      window.open(resourceUrl);
    }
  };

  const handleCopyResourceLinkBtnClick = (resource: Resource) => {
    const url = getResourceUrl(resource);
    copy(url);
    toast.success(t("message.succeed-copy-resource-link"));
  };

  const handleSelectBtnClick = () => {
    if (isSelected) {
      handleUncheckClick();
    } else {
      handlecheckClick();
    }
    setIsSelected(!isSelected);
  };

  return (
    <div key={resource.id} className="px-2 py-2 w-full grid grid-cols-7">
      <span className="w-full truncate text-base pr-2 last:pr-0 col-span-1 flex justify-center">
        <input type="checkbox" onClick={handleSelectBtnClick}></input>
      </span>
      <span className="w-full truncate text-base pr-2 last:pr-0 col-span-1">{resource.id}</span>
      <span className="w-full truncate text-base pr-2 last:pr-0 col-span-4" onClick={() => handleRenameBtnClick(resource)}>
        {resource.filename}
      </span>
      <div className="w-full flex flex-row justify-between items-center mb-2">
        <Dropdown
          actionsClassName="!w-28"
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
                className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded text-red-600 hover:bg-gray-100 dark:hover:bg-zinc-600"
                onClick={() => handleDeleteResourceBtnClick(resource)}
              >
                {t("common.delete")}
              </button>
            </>
          }
        />
      </div>
    </div>
  );
};

export default ResourceItem;
