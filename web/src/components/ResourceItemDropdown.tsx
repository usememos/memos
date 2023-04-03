import copy from "copy-to-clipboard";
import React from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useResourceStore } from "@/store/module";
import { getResourceUrl } from "@/utils/resource";
import Dropdown from "./base/Dropdown";
import Icon from "./Icon";
import { showCommonDialog } from "./Dialog/CommonDialog";
import showChangeResourceFilenameDialog from "./ChangeResourceFilenameDialog";
import showPreviewImageDialog from "./PreviewImageDialog";

interface Props {
  resource: Resource;
}

const ResourceItemDropdown = ({ resource }: Props) => {
  const { t } = useTranslation();
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;

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

  const handleResetResourceLinkBtnClick = (resource: Resource) => {
    showCommonDialog({
      title: "Reset resource link",
      content: "Are you sure to reset the resource link?",
      style: "warning",
      dialogName: "reset-resource-link-dialog",
      onConfirm: async () => {
        await resourceStore.patchResource({
          id: resource.id,
          resetPublicId: true,
        });
      },
    });
  };

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
            onClick={() => handleResetResourceLinkBtnClick(resource)}
          >
            Reset link
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
