import { Button } from "@mui/joy";
import copy from "copy-to-clipboard";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import useLoading from "../hooks/useLoading";
import { useResourceStore } from "../store/module";
import { getResourceUrl } from "../utils/resource";
import Icon from "./Icon";
import toastHelper from "./Toast";
import Dropdown from "./common/Dropdown";
import { generateDialog } from "./Dialog";
import { showCommonDialog } from "./Dialog/CommonDialog";
import showPreviewImageDialog from "./PreviewImageDialog";
import showChangeResourceFilenameDialog from "./ChangeResourceFilenameDialog";
import "../less/resources-dialog.less";

type Props = DialogProps;

const ResourcesDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const { t } = useTranslation();
  const loadingState = useLoading();
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;

  useEffect(() => {
    resourceStore
      .fetchResourceList()
      .catch((error) => {
        console.error(error);
        toastHelper.error(error.response.data.message);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, []);

  const handleUploadFileBtnClick = async () => {
    const inputEl = document.createElement("input");
    inputEl.style.position = "fixed";
    inputEl.style.top = "-100vh";
    inputEl.style.left = "-100vw";
    document.body.appendChild(inputEl);
    inputEl.type = "file";
    inputEl.multiple = true;
    inputEl.accept = "*";
    inputEl.onchange = async () => {
      if (!inputEl.files || inputEl.files.length === 0) {
        return;
      }

      for (const file of inputEl.files) {
        try {
          await resourceStore.createResourceWithBlob(file);
        } catch (error: any) {
          console.error(error);
          toastHelper.error(error.response.data.message);
        }
      }

      document.body.removeChild(inputEl);
    };
    inputEl.click();
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

  const handleRenameBtnClick = (resource: Resource) => {
    showChangeResourceFilenameDialog(resource.id, resource.filename);
  };

  const handleCopyResourceLinkBtnClick = (resource: Resource) => {
    const url = getResourceUrl(resource);
    copy(url);
    toastHelper.success(t("message.succeed-copy-resource-link"));
  };

  const handleDeleteUnusedResourcesBtnClick = () => {
    let warningText = t("resources.warning-text-unused");
    const unusedResources = resources.filter((resource) => {
      if (resource.linkedMemoAmount === 0) {
        warningText = warningText + `\n- ${resource.filename}`;
        return true;
      }
      return false;
    });
    if (unusedResources.length === 0) {
      toastHelper.success(t("resources.no-unused-resources"));
      return;
    }
    showCommonDialog({
      title: t("resources.delete-resource"),
      content: warningText,
      style: "warning",
      dialogName: "delete-unused-resources",
      onConfirm: async () => {
        for (const resource of unusedResources) {
          await resourceStore.deleteResourceById(resource.id);
        }
      },
    });
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
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("sidebar.resources")}</p>
        <button className="btn close-btn" onClick={destroy}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="w-full flex flex-row justify-between items-center">
          <div className="flex flex-row justify-start items-center space-x-2">
            <Button onClick={() => handleUploadFileBtnClick()} startDecorator={<Icon.Plus className="w-5 h-auto" />}>
              {t("common.create")}
            </Button>
          </div>
          <div className="flex flex-row justify-end items-center">
            <Button color="danger" onClick={handleDeleteUnusedResourcesBtnClick} startDecorator={<Icon.Trash2 className="w-4 h-auto" />}>
              <span>{t("resources.clear")}</span>
            </Button>
          </div>
        </div>
        {loadingState.isLoading ? (
          <div className="loading-text-container">
            <p className="tip-text">{t("resources.fetching-data")}</p>
          </div>
        ) : (
          <div className="resource-table-container">
            <div className="fields-container">
              <span className="field-text id-text">ID</span>
              <span className="field-text name-text">{t("resources.name")}</span>
              <span></span>
            </div>
            {resources.length === 0 ? (
              <p className="tip-text">{t("resources.no-resources")}</p>
            ) : (
              resources.map((resource) => (
                <div key={resource.id} className="resource-container">
                  <span className="field-text id-text">{resource.id}</span>
                  <span className="field-text name-text" onClick={() => handleRenameBtnClick(resource)}>
                    {resource.filename}
                  </span>
                  <div className="buttons-container">
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
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default function showResourcesDialog() {
  generateDialog(
    {
      className: "resources-dialog",
      dialogName: "resources-dialog",
    },
    ResourcesDialog,
    {}
  );
}
