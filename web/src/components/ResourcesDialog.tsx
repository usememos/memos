import copy from "copy-to-clipboard";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as utils from "../helpers/utils";
import useLoading from "../hooks/useLoading";
import { resourceService } from "../services";
import { useAppSelector } from "../store";
import Icon from "./Icon";
import toastHelper from "./Toast";
import Dropdown from "./common/Dropdown";
import { generateDialog } from "./Dialog";
import { showCommonDialog } from "./Dialog/CommonDialog";
import showPreviewImageDialog from "./PreviewImageDialog";
import showChangeResourceFilenameDialog from "./ChangeResourceFilenameDialog";
import "../less/resources-dialog.less";

type Props = DialogProps;

interface State {
  isUploadingResource: boolean;
}

const ResourcesDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const { t } = useTranslation();
  const loadingState = useLoading();
  const { resources } = useAppSelector((state) => state.resource);
  const [state, setState] = useState<State>({
    isUploadingResource: false,
  });

  useEffect(() => {
    resourceService
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
    if (state.isUploadingResource) {
      return;
    }

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

      setState({
        ...state,
        isUploadingResource: true,
      });

      for (const file of inputEl.files) {
        try {
          await resourceService.upload(file);
        } catch (error: any) {
          console.error(error);
          toastHelper.error(error.response.data.message);
        } finally {
          setState({
            ...state,
            isUploadingResource: false,
          });
        }
      }

      document.body.removeChild(inputEl);
    };
    inputEl.click();
  };

  const getResourceUrl = useCallback((resource: Resource) => {
    return `${window.location.origin}/o/r/${resource.id}/${resource.filename}`;
  }, []);

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
    copy(`${window.location.origin}/o/r/${resource.id}/${resource.filename}`);
    toastHelper.success("Succeed to copy resource link to clipboard");
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
      onConfirm: async () => {
        for (const resource of unusedResources) {
          await resourceService.deleteResourceById(resource.id);
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
      onConfirm: async () => {
        await resourceService.deleteResourceById(resource.id);
      },
    });
  };

  const handleResourceNameOrTypeMouseEnter = useCallback((event: React.MouseEvent, nameOrType: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.className = "usage-detail-container pop-up";
    const bounding = utils.getElementBounding(event.target as HTMLElement);
    tempDiv.style.left = bounding.left + "px";
    tempDiv.style.top = bounding.top - 2 + "px";
    tempDiv.innerHTML = `<span>${nameOrType}</span>`;
    document.body.appendChild(tempDiv);
  }, []);

  const handleResourceNameOrTypeMouseLeave = useCallback(() => {
    document.body.querySelectorAll("div.usage-detail-container.pop-up").forEach((node) => node.remove());
  }, []);

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🌄</span>
          {t("sidebar.resources")}
        </p>
        <button className="btn close-btn" onClick={destroy}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="action-buttons-container">
          <div className="buttons-wrapper">
            <div className="upload-resource-btn" onClick={() => handleUploadFileBtnClick()}>
              <Icon.File className="icon-img" />
              <span>{t("resources.upload")}</span>
            </div>
          </div>
          <div className="buttons-wrapper">
            <div className="delete-unused-resource-btn" onClick={handleDeleteUnusedResourcesBtnClick}>
              <Icon.Trash2 className="icon-img" />
              <span>{t("resources.clear-unused-resources")}</span>
            </div>
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
              <span className="field-text name-text">NAME</span>
              <span></span>
            </div>
            {resources.length === 0 ? (
              <p className="tip-text">{t("resources.no-resources")}</p>
            ) : (
              resources.map((resource) => (
                <div key={resource.id} className="resource-container">
                  <span className="field-text id-text">{resource.id}</span>
                  <span className="field-text name-text">
                    <span
                      onMouseEnter={(e) => handleResourceNameOrTypeMouseEnter(e, resource.filename)}
                      onMouseLeave={handleResourceNameOrTypeMouseLeave}
                    >
                      {resource.filename}
                    </span>
                  </span>
                  <div className="buttons-container">
                    <Dropdown
                      actionsClassName="!w-28"
                      actions={
                        <>
                          <button
                            className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100"
                            onClick={() => handlePreviewBtnClick(resource)}
                          >
                            {t("resources.preview")}
                          </button>
                          <button
                            className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100"
                            onClick={() => handleRenameBtnClick(resource)}
                          >
                            {t("resources.rename")}
                          </button>
                          <button
                            className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100"
                            onClick={() => handleCopyResourceLinkBtnClick(resource)}
                          >
                            {t("resources.copy-link")}
                          </button>
                          <button
                            className="w-full text-left text-sm leading-6 py-1 px-3 cursor-pointer rounded text-red-600 hover:bg-gray-100"
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
    },
    ResourcesDialog,
    {}
  );
}
